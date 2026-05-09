<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\PaymentReceipt;
use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        // Explicit date_from/date_to from frontend takes priority (frontend computes the range).
        // Frontend sends full UTC ISO datetimes representing local day boundaries — use as-is.
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $range = [
                'from' => Carbon::parse($request->date_from),
                'to'   => Carbon::parse($request->date_to),
            ];
            $period = 'custom';
        } else {
            $period = $request->query('period', 'today');
            $range = $this->getDateRange($period, $request->query('local_date'));

            // If financial_year_id is provided, apply FY-aware date logic
            if ($request->financial_year_id) {
                $fy = FinancialYear::find($request->financial_year_id);
                if ($fy) {
                    $fyStart = Carbon::parse($fy->start_date)->startOfDay();
                    $fyEnd = Carbon::parse($fy->end_date)->endOfDay();
                    if ($period === 'this_year') {
                        $range = ['from' => $fyStart, 'to' => $fyEnd];
                    } else {
                        if ($range['from']->lt($fyStart)) {
                            $range['from'] = $fyStart;
                        }
                        if ($range['to']->gt($fyEnd)) {
                            $range['to'] = $fyEnd;
                        }
                    }
                }
            }
        }

        $salesQuery = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']]);

        $salesTotal = (float) $salesQuery->sum('grand_total');
        $salesTaxable = (float) $salesQuery->sum('taxable_amount');
        $salesCgst = (float) $salesQuery->sum('cgst_total');
        $salesSgst = (float) $salesQuery->sum('sgst_total');
        $salesIgst = (float) $salesQuery->sum('igst_total');

        $purchaseQuery = PurchaseInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']]);

        $purchaseTotal = (float) $purchaseQuery->sum('grand_total');
        $purchaseTaxable = (float) $purchaseQuery->sum('taxable_amount');
        $purchaseCgst = (float) $purchaseQuery->sum('cgst_total');
        $purchaseSgst = (float) $purchaseQuery->sum('sgst_total');
        $purchaseIgst = (float) $purchaseQuery->sum('igst_total');

        // ── Net Revenue: taxable sales (same filter as total_sales) ──────────
        // net_revenue = total_sales − total_gst = sales_taxable
        // Both use status != 'cancelled', so the math is always consistent.
        $netRevenue = $salesTaxable;

        // ── GST Payable from accounting ledgers (posted vouchers) ─────────────
        // Output GST ledgers (liability): net credit = GST collected from customers
        // Input GST ledgers (ITC asset):  net debit  = GST paid to vendors
        // Reading from ledgers guarantees this matches the books (Trial Balance / GST report).
        $gstLedgerRows = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->join('ledgers', 'voucher_lines.ledger_id', '=', 'ledgers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('ledgers.system_key', [
                'output_cgst', 'output_sgst', 'output_igst',
                'input_cgst',  'input_sgst',  'input_igst',
            ])
            ->whereDate('vouchers.voucher_date', '>=', $range['from']->toDateString())
            ->whereDate('vouchers.voucher_date', '<=', $range['to']->toDateString())
            ->select(
                'ledgers.system_key',
                DB::raw('SUM(voucher_lines.debit)  as total_debit'),
                DB::raw('SUM(voucher_lines.credit) as total_credit')
            )
            ->groupBy('ledgers.system_key')
            ->get()
            ->keyBy('system_key');

        $netBalance = fn (string $key): float => (float) ($gstLedgerRows[$key]->total_credit ?? 0)
                                               - (float) ($gstLedgerRows[$key]->total_debit ?? 0);

        // Output GST = net credit on output ledgers (positive = liability)
        $gstOutputCgst = $netBalance('output_cgst');
        $gstOutputSgst = $netBalance('output_sgst');
        $gstOutputIgst = $netBalance('output_igst');
        $gstOutput = $gstOutputCgst + $gstOutputSgst + $gstOutputIgst;

        // ITC = net debit on input ledgers (positive = credit available)
        $gstInputCgst = -$netBalance('input_cgst');  // net_debit = -(net_credit)
        $gstInputSgst = -$netBalance('input_sgst');
        $gstInputIgst = -$netBalance('input_igst');
        $gstInputCredit = $gstInputCgst + $gstInputSgst + $gstInputIgst;

        $payableTax = $gstOutput - $gstInputCredit;

        // ── P&L from journal lines (matches P&L report exactly) ────────────────
        // Income ledgers: amount = net credit (credit − debit)
        // Expense ledgers: amount = net debit (debit − credit)
        $pnlLedgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->get();

        $pnlIncome = 0.0;
        $pnlExpense = 0.0;

        if ($pnlLedgers->isNotEmpty()) {
            $journalTotals = DB::table('voucher_lines')
                ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
                ->where('vouchers.company_id', $companyId)
                ->where('vouchers.is_posted', true)
                ->whereIn('voucher_lines.ledger_id', $pnlLedgers->pluck('id'))
                ->whereDate('vouchers.voucher_date', '>=', $range['from']->toDateString())
                ->whereDate('vouchers.voucher_date', '<=', $range['to']->toDateString())
                ->select(
                    'voucher_lines.ledger_id',
                    DB::raw('SUM(voucher_lines.debit) as total_debit'),
                    DB::raw('SUM(voucher_lines.credit) as total_credit')
                )
                ->groupBy('voucher_lines.ledger_id')
                ->get()
                ->keyBy('ledger_id');

            foreach ($pnlLedgers as $ledger) {
                $txn = $journalTotals[$ledger->id] ?? null;
                $debit = (float) ($txn->total_debit ?? 0);
                $credit = (float) ($txn->total_credit ?? 0);

                if ($ledger->group?->type === 'income') {
                    $pnlIncome += $credit - $debit;
                } else {
                    $pnlExpense += $debit - $credit;
                }
            }
        }

        // ── Stock valuation: SUM(qty) × purchase_price (matches P&L report) ──
        // We use quantity × cost price, NOT the value column, because sales entries
        // store selling price in value — using value would overstate closing stock.
        $stockValue = function (?string $beforeDate, ?string $upToDate) use ($companyId): float {
            $q = DB::table('stock_ledger')->where('company_id', $companyId);
            if ($beforeDate) {
                $q->whereDate('created_at', '<', $beforeDate);
            } elseif ($upToDate) {
                $q->whereDate('created_at', '<=', $upToDate);
            }
            $rows = $q->select('item_id', DB::raw('SUM(quantity) as total_qty'))
                ->groupBy('item_id')
                ->havingRaw('SUM(quantity) > 0')
                ->get();
            if ($rows->isEmpty()) {
                return 0.0;
            }
            $prices = DB::table('items')
                ->whereIn('id', $rows->pluck('item_id'))
                ->pluck('purchase_price', 'id');
            $val = 0.0;
            foreach ($rows as $row) {
                $val += (float) $row->total_qty * (float) ($prices[$row->item_id] ?? 0);
            }

            return $val;
        };

        $openingStock = $stockValue($range['from']->toDateString(), null);
        $closingStock = $stockValue(null, $range['to']->toDateString());

        // Net P&L = Income − Expense + Closing Stock − Opening Stock
        $pnl = $pnlIncome - $pnlExpense + $closingStock - $openingStock;

        return response()->json([
            'data' => [
                'period' => $period,
                'from' => $range['from']->toDateString(),
                'to' => $range['to']->toDateString(),
                'total_sales' => round($salesTotal, 2),
                'sales_taxable' => round($salesTaxable, 2),
                'sales_cgst' => round($salesCgst, 2),
                'sales_sgst' => round($salesSgst, 2),
                'sales_igst' => round($salesIgst, 2),
                'total_purchase' => round($purchaseTotal, 2),
                'purchase_taxable' => round($purchaseTaxable, 2),
                'purchase_cgst' => round($purchaseCgst, 2),
                'purchase_sgst' => round($purchaseSgst, 2),
                'purchase_igst' => round($purchaseIgst, 2),
                'pnl_income' => round($pnlIncome, 2),
                'pnl_expense' => round($pnlExpense, 2),
                'opening_stock' => round($openingStock, 2),
                'closing_stock' => round($closingStock, 2),
                'pnl' => round($pnl, 2),
                'net_revenue' => round($netRevenue, 2),
                'gst_output' => round($gstOutput, 2),
                'gst_output_cgst' => round($gstOutputCgst, 2),
                'gst_output_sgst' => round($gstOutputSgst, 2),
                'gst_output_igst' => round($gstOutputIgst, 2),
                'gst_input_credit' => round($gstInputCredit, 2),
                'gst_input_cgst' => round($gstInputCgst, 2),
                'gst_input_sgst' => round($gstInputSgst, 2),
                'gst_input_igst' => round($gstInputIgst, 2),
                'payable_tax' => round($payableTax, 2),
            ],
        ]);
    }

    public function chart(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $months = (int) $request->query('months', 12);
        $months = min(max($months, 3), 24);

        // Use client local date (ISO-8601 YYYY-MM-DD) so month boundaries
        // align with the user's calendar day, not the UTC server date.
        $localDate = $request->query('local_date');
        $today = $localDate ? Carbon::parse($localDate) : Carbon::today();
        $end = $today->copy()->endOfMonth();
        $start = $today->copy()->subMonths($months - 1)->startOfMonth();

        // Clamp to financial year if provided
        if ($request->financial_year_id) {
            $fy = FinancialYear::find($request->financial_year_id);
            if ($fy) {
                $fyStart = Carbon::parse($fy->start_date)->startOfMonth();
                $fyEnd = Carbon::parse($fy->end_date)->endOfMonth();
                if ($start->lt($fyStart)) {
                    $start = $fyStart;
                }
                if ($end->gt($fyEnd)) {
                    $end = $fyEnd;
                }
            }
        }

        $salesByMonth = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(grand_total) as total, SUM(taxable_amount) as revenue")
            ->groupBy('month')
            ->pluck('total', 'month')
            ->toArray();

        $revenueByMonth = SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(taxable_amount) as revenue")
            ->groupBy('month')
            ->pluck('revenue', 'month')
            ->toArray();

        $purchaseByMonth = PurchaseInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$start, $end])
            ->selectRaw("DATE_FORMAT(invoice_date, '%Y-%m') as month, SUM(grand_total) as total")
            ->groupBy('month')
            ->pluck('total', 'month')
            ->toArray();

        // Build ordered labels and data arrays
        $labels = [];
        $sales = [];
        $purchase = [];
        $revenue = [];
        $cursor = $start->copy();

        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m');
            $labels[] = $cursor->format('M Y'); // e.g. "Apr 2026"
            $sales[] = round((float) ($salesByMonth[$key] ?? 0), 2);
            $purchase[] = round((float) ($purchaseByMonth[$key] ?? 0), 2);
            $revenue[] = round((float) ($revenueByMonth[$key] ?? 0), 2);
            $cursor->addMonth();
        }

        return response()->json([
            'data' => compact('labels', 'sales', 'purchase', 'revenue'),
        ]);
    }

    public function collection(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        if ($request->filled('date_from') && $request->filled('date_to')) {
            $range = [
                'from' => Carbon::parse($request->date_from),
                'to'   => Carbon::parse($request->date_to),
            ];
            $period = 'custom';
        } else {
            $period = $request->query('period', 'today');
            $range = $this->getDateRange($period, $request->query('local_date'));

            if ($request->financial_year_id) {
                $fy = FinancialYear::find($request->financial_year_id);
                if ($fy) {
                    $fyStart = Carbon::parse($fy->start_date)->startOfDay();
                    $fyEnd = Carbon::parse($fy->end_date)->endOfDay();
                    if ($period === 'this_year') {
                        $range = ['from' => $fyStart, 'to' => $fyEnd];
                    } else {
                        if ($range['from']->lt($fyStart)) {
                            $range['from'] = $fyStart;
                        }
                        if ($range['to']->gt($fyEnd)) {
                            $range['to'] = $fyEnd;
                        }
                    }
                }
            }
        }

        $base = PaymentReceipt::where('company_id', $companyId)
            ->where('type', 'receipt')
            ->whereNull('deleted_at')
            ->where('receipt_date', '>=', $range['from'])
            ->where('receipt_date', '<=', $range['to']);

        $total = (float) (clone $base)->sum('amount');
        $cash = (float) (clone $base)->where('payment_mode', 'cash')->sum('amount');
        $account = (float) (clone $base)->where('payment_mode', '!=', 'cash')->sum('amount');

        $needToCollect = (float) SalesInvoice::where('company_id', $companyId)
            ->where('status', '!=', 'cancelled')
            ->whereBetween('invoice_date', [$range['from'], $range['to']])
            ->sum('balance_due');

        return response()->json([
            'data' => [
                'period' => $period,
                'from' => $range['from']->toDateString(),
                'to' => $range['to']->toDateString(),
                'total' => round($total, 2),
                'cash' => round($cash, 2),
                'account' => round($account, 2),
                'need_to_collect' => round($needToCollect, 2),
            ],
        ]);
    }

    private function getDateRange(string $period, ?string $localDate = null): array
    {
        // localDate is ISO-8601 YYYY-MM-DD sent by the client so that "today"
        // reflects the user's calendar day rather than the UTC server date.
        $now = $localDate ? Carbon::parse($localDate) : Carbon::today();

        return match ($period) {
            'today' => [
                'from' => $now->copy()->startOfDay(),
                'to' => $now->copy()->endOfDay(),
            ],
            'this_week' => [
                'from' => $now->copy()->startOfWeek(),
                'to' => $now->copy()->endOfWeek(),
            ],
            'this_month' => [
                'from' => $now->copy()->startOfMonth(),
                'to' => $now->copy()->endOfMonth(),
            ],
            'this_year' => [
                'from' => $now->copy()->startOfYear(),
                'to' => $now->copy()->endOfYear(),
            ],
            default => [
                'from' => $now->copy()->startOfDay(),
                'to' => $now->copy()->endOfDay(),
            ],
        };
    }
}
