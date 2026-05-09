<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
use App\Models\Activity;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\LedgerClosingBalance;
use App\Models\Party;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Trial Balance — all ledgers with their net balance.
     *
     * Balance = Opening Balance + Sum(Debits) - Sum(Credits)
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // 1. All active accounting groups — returned as folder/group rows
        $groups = AccountingGroup::where('company_id', $companyId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        // 2. All ledgers with their group info
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // 3. Voucher line totals per ledger
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true);

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $openingSnapshots = $this->resolveOpeningBalances($companyId, $request->financial_year_id);

        $rows = [];
        $grandTotalDebit = 0;
        $grandTotalCredit = 0;

        // Group rows (is_group = true) — values are aggregated on the frontend from children
        foreach ($groups as $group) {
            $rows[] = [
                'account_id' => $group->id,
                'name' => $group->name,
                'code' => $group->code ?? '',
                'type' => $group->type,
                'parent_id' => $group->parent_id, // null for root groups
                'is_group' => true,
                'opening_debit' => 0,
                'opening_credit' => 0,
                'txn_debit' => 0,
                'txn_credit' => 0,
                'closing_debit' => 0,
                'closing_credit' => 0,
            ];
        }

        // Ledger rows (is_group = false) — parent is their accounting group
        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $txnDebit = (float) ($txn->total_debit ?? 0);
            $txnCredit = (float) ($txn->total_credit ?? 0);

            [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);

            $totalDebit = $openingDebit + $txnDebit;
            $totalCredit = $openingCredit + $txnCredit;

            $net = $totalDebit - $totalCredit;
            $closingDebit = $net > 0 ? round($net, 2) : 0;
            $closingCredit = $net < 0 ? round(abs($net), 2) : 0;

            $grandTotalDebit += $closingDebit;
            $grandTotalCredit += $closingCredit;

            $rows[] = [
                'account_id' => $ledger->id,
                'name' => $ledger->name,
                'code' => $ledger->group?->code ?? '',
                'type' => $ledger->group?->type ?? 'asset',
                'parent_id' => $ledger->group_id, // ledger's parent = its accounting group
                'is_group' => false,
                'opening_debit' => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
                'txn_debit' => round($txnDebit, 2),
                'txn_credit' => round($txnCredit, 2),
                'closing_debit' => $closingDebit,
                'closing_credit' => $closingCredit,
            ];
        }

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_debit' => round($grandTotalDebit, 2),
                'total_credit' => round($grandTotalCredit, 2),
                'difference' => round($grandTotalDebit - $grandTotalCredit, 2),
            ],
        ]);
    }

    /**
     * Ledger drill-down — all posted voucher lines for a specific ledger
     * with opening balance and running balance.
     */
    public function ledgerTransactions(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $request->validate(['ledger_id' => 'required|uuid|exists:ledgers,id']);

        $companyId = $request->user()->company_id;
        $ledger = Ledger::with('group')
            ->where('company_id', $companyId)
            ->findOrFail($request->ledger_id);

        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->where('voucher_lines.ledger_id', $ledger->id);

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $entries = $query->select(
            'vouchers.id as voucher_id',
            'vouchers.voucher_number',
            'vouchers.voucher_date',
            'vouchers.created_at',
            'vouchers.voucher_type',
            'vouchers.narration as entry_narration',
            'voucher_lines.debit',
            'voucher_lines.credit',
            'voucher_lines.narration as line_narration'
        )
            ->orderBy('vouchers.voucher_date')
            ->orderBy('vouchers.created_at')
            ->get();

        $openingSnapshots = $this->resolveOpeningBalances($companyId, $request->financial_year_id);
        [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);
        $runningBalance = $openingDebit - $openingCredit;

        $rows = [];
        foreach ($entries as $entry) {
            $debit = (float) $entry->debit;
            $credit = (float) $entry->credit;
            $runningBalance += ($debit - $credit);

            $rows[] = [
                'voucher_id' => $entry->voucher_id,
                'voucher_number' => $entry->voucher_number,
                'voucher_date' => $entry->voucher_date,
                'created_at' => $entry->created_at,
                'voucher_type' => $entry->voucher_type,
                'narration' => $entry->line_narration ?? $entry->entry_narration,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round($runningBalance, 2),
            ];
        }

        return response()->json([
            'ledger' => [
                'id' => $ledger->id,
                'name' => $ledger->name,
                'group_name' => $ledger->group?->name,
                'opening_debit' => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
            ],
            'data' => array_reverse($rows),
            'closing_balance' => round($runningBalance, 2),
        ]);
    }

    /**
     * Calculate Opening and Closing stock values for P&L.
     *
     * Strategy: SUM(quantity) per item × item.purchase_price.
     * We use quantity (properly signed: +in / -out) rather than the value
     * column because sales entries store the selling price (positive),
     * not the cost, so SUM(value) is incorrect for stock valuation.
     *
     * @return array{float, float} [openingStockValue, closingStockValue]
     */
    private function calcStockValues(string $companyId, ?string $dateFrom, ?string $dateTo): array
    {
        // Helper: sum of (qty × item.purchase_price) for all items with a given date filter
        $stockValue = function (?string $beforeDate, ?string $upToDate) use ($companyId): float {
            $query = DB::table('stock_ledger as sl')
                ->where('sl.company_id', $companyId);

            if ($beforeDate) {
                $query->whereDate('sl.date', '<', $beforeDate);
            } elseif ($upToDate) {
                $query->whereDate('sl.date', '<=', $upToDate);
            }

            $rows = $query
                ->select('sl.item_id', DB::raw('SUM(sl.quantity) as total_qty'))
                ->groupBy('sl.item_id')
                ->havingRaw('SUM(sl.quantity) > 0')
                ->get();

            if ($rows->isEmpty()) {
                return 0.0;
            }

            $itemIds = $rows->pluck('item_id')->toArray();
            $prices = DB::table('items')
                ->whereIn('id', $itemIds)
                ->pluck('purchase_price', 'id');

            $value = 0.0;
            foreach ($rows as $row) {
                $price = (float) ($prices[$row->item_id] ?? 0);
                $value += (float) $row->total_qty * $price;
            }

            return $value;
        };

        if ($dateFrom) {
            // Date range provided: opening = stock on hand BEFORE period start
            $openingStock = $stockValue($dateFrom, null);
            $closingStock = $stockValue(null, $dateTo ?? date('Y-m-d'));
        } else {
            // No date range: opening = only 'opening' type entries (preserves the
            // original entered rate), closing = current stock at purchase price
            $openingStock = (float) DB::table('stock_ledger')
                ->where('company_id', $companyId)
                ->where('type', 'opening')
                ->sum('value');

            $closingStock = $stockValue(null, null);
        }

        return [$openingStock, $closingStock];
    }

    /**
     * Resolve date range from explicit params or FY.
     */
    private function resolveDateRange(Request $request): array
    {
        if ($request->date_from && $request->date_to) {
            return [$request->date_from, $request->date_to];
        }

        $fyId = $request->financial_year_id;
        if ($fyId) {
            $fy = FinancialYear::find($fyId);
            if ($fy) {
                return [
                    $fy->start_date . 'T00:00:00.000Z',
                    $fy->end_date   . 'T23:59:59.999Z',
                ];
            }
        }

        return [null, null];
    }

    /**
     * Resolve the effective opening balance snapshots for a given FY.
     *
     * Returns a Collection keyed by ledger_id containing LedgerClosingBalance
     * records from the immediately preceding FY. Empty collection means no prior
     * snapshot exists — callers should fall back to the static ledger opening balance.
     */
    private function resolveOpeningBalances(string $companyId, ?string $financialYearId): Collection
    {
        if (!$financialYearId) {
            return collect();
        }

        $currentFY = FinancialYear::find($financialYearId);
        if (!$currentFY) {
            return collect();
        }

        $previousFY = FinancialYear::where('company_id', $companyId)
            ->whereDate('end_date', '<', $currentFY->start_date)
            ->orderByDesc('end_date')
            ->first();

        if (!$previousFY) {
            return collect();
        }

        return LedgerClosingBalance::where('financial_year_id', $previousFY->id)
            ->get()
            ->keyBy('ledger_id');
    }

    /**
     * Resolve a single ledger's opening debit/credit using the snapshot collection.
     *
     * Rules:
     *  - Balance-sheet accounts (asset/liability/equity): use previous FY closing snapshot.
     *  - P&L accounts (income/expense): reset to zero in any non-first FY (snapshots exist).
     *  - Fallback: static ledger.opening_balance when no snapshot collection is available.
     *
     * @return array{float, float} [$openingDebit, $openingCredit]
     */
    private function resolveLedgerOpening(Ledger $ledger, Collection $openingSnapshots): array
    {
        $snap      = $openingSnapshots->get($ledger->id);
        $groupType = $ledger->group?->type ?? 'asset';
        $isPnL     = in_array($groupType, ['income', 'expense']);

        if ($snap && !$isPnL) {
            return [
                $snap->balance_type === 'dr' ? (float) $snap->closing_balance : 0.0,
                $snap->balance_type === 'cr' ? (float) $snap->closing_balance : 0.0,
            ];
        }

        if ($openingSnapshots->isNotEmpty() && $isPnL) {
            return [0.0, 0.0];
        }

        return [
            $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0.0,
            $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0.0,
        ];
    }

    /**
     * Balance Sheet — Assets vs Liabilities + Equity as at a date.
     *
     * Tally convention:
     *  - Left  : Liabilities & Equity (Capital, Loans, Creditors, Duties & Taxes)
     *  - Right : Assets (Fixed Assets, Current Assets → Stock, Debtors, Bank, Cash)
     *  - Net Profit (from P&L) is added to the Liabilities side under Capital.
     *  - Closing Stock (from stock_ledger) is added to the Assets side.
     */
    public function balanceSheet(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // ── 1. Balance-sheet groups & ledgers (asset, liability, equity only) ──
        $groups = AccountingGroup::where('company_id', $companyId)
            ->whereIn('type', ['asset', 'liability', 'equity'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['asset', 'liability', 'equity']))
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // ── 2. Voucher-line totals for every ledger ──────────────────────────
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true);

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $openingSnapshots = $this->resolveOpeningBalances($companyId, $request->financial_year_id);

        // ── 3. Build rows ─────────────────────────────────────────────────────
        $rows = [];
        $totalAssets = 0;
        $totalLiabEq = 0;

        // Group rows — values are 0; frontend aggregates from children
        foreach ($groups as $group) {
            $rows[] = [
                'account_id' => $group->id,
                'name' => $group->name,
                'code' => $group->code ?? '',
                'type' => $group->type,
                'parent_id' => $group->parent_id,
                'is_group' => true,
                'opening_debit' => 0,
                'opening_credit' => 0,
                'txn_debit' => 0,
                'txn_credit' => 0,
                'closing_debit' => 0,
                'closing_credit' => 0,
            ];
        }

        // Ledger rows — same calculation as trialBalance()
        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $txnDebit = (float) ($txn->total_debit ?? 0);
            $txnCredit = (float) ($txn->total_credit ?? 0);

            [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);

            $totalDebit = $openingDebit + $txnDebit;
            $totalCredit = $openingCredit + $txnCredit;

            $net = $totalDebit - $totalCredit;
            $closingDebit = $net > 0 ? round($net, 2) : 0;
            $closingCredit = $net < 0 ? round(abs($net), 2) : 0;

            $groupType = $ledger->group?->type;

            if ($groupType === 'asset') {
                $totalAssets += ($closingDebit - $closingCredit);
            } else {
                $totalLiabEq += ($closingCredit - $closingDebit);
            }

            $rows[] = [
                'account_id' => $ledger->id,
                'name' => $ledger->name,
                'code' => $ledger->group?->code ?? '',
                'type' => $groupType ?? 'asset',
                'parent_id' => $ledger->group_id,
                'is_group' => false,
                'opening_debit' => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
                'txn_debit' => round($txnDebit, 2),
                'txn_credit' => round($txnCredit, 2),
                'closing_debit' => $closingDebit,
                'closing_credit' => $closingCredit,
            ];
        }

        // ── 4. Net Profit/Loss from P&L (same logic as profitAndLoss()) ──────
        $pnlLedgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->get();

        $pnlQuery = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.ledger_id', $pnlLedgers->pluck('id'));

        if ($dateFrom && $dateTo) {
            $pnlQuery->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $pnlTotals = $pnlQuery->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $totalIncome = 0;
        $totalExpense = 0;

        foreach ($pnlLedgers as $ledger) {
            $txn = $pnlTotals[$ledger->id] ?? null;
            $debit = (float) ($txn->total_debit ?? 0);
            $credit = (float) ($txn->total_credit ?? 0);

            [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);

            $totalDebit = $openingDebit + $debit;
            $totalCredit = $openingCredit + $credit;

            if ($ledger->group?->type === 'income') {
                $totalIncome += ($totalCredit - $totalDebit);
            } else {
                $totalExpense += ($totalDebit - $totalCredit);
            }
        }

        [$openingStock, $closingStock] = $this->calcStockValues($companyId, $dateFrom, $dateTo);

        $netProfitLoss = $totalIncome - $totalExpense + $closingStock - $openingStock;
        $isProfit = $netProfitLoss >= 0;

        // ── 5. Difference diagnostic ─────────────────────────────────────────
        // Correct balance-sheet equation (unified for profit and loss):
        //   (Assets + Closing Stock) = (Liabilities + Equity + Net Profit/Loss)
        // Net Profit/Loss already includes closing stock effect via COGS, so closing
        // stock must be added to the Assets side to make both sides equal.
        // $netProfitLoss is signed: positive = profit, negative = loss.
        $difference = round(($totalAssets + $closingStock) - ($totalLiabEq + $netProfitLoss), 2);

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_assets' => round($totalAssets, 2),
                'total_liabilities_equity' => round($totalLiabEq, 2),
                'net_profit' => round(abs($netProfitLoss), 2),
                'is_profit' => $isProfit,
                'closing_stock' => round($closingStock, 2),
                'difference' => $difference,
            ],
        ]);
    }

    /**
     * Profit & Loss Statement — hierarchical income/expense groups and ledgers.
     *
     * Returns a flat list of rows (groups + ledgers) that the frontend builds
     * into an expandable tree. Groups have amount=0 (frontend aggregates from children).
     */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // 1. All active income/expense accounting groups
        $groups = AccountingGroup::where('company_id', $companyId)
            ->whereIn('type', ['income', 'expense'])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        // 2. All income/expense ledgers
        $ledgers = Ledger::with('group')
            ->where('company_id', $companyId)
            ->whereHas('group', fn ($q) => $q->whereIn('type', ['income', 'expense']))
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get();

        // 3. Voucher line totals
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.ledger_id', $ledgers->pluck('id'));

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $totals = $query->select(
            'voucher_lines.ledger_id',
            DB::raw('SUM(voucher_lines.debit) as total_debit'),
            DB::raw('SUM(voucher_lines.credit) as total_credit')
        )
            ->groupBy('voucher_lines.ledger_id')
            ->get()
            ->keyBy('ledger_id');

        $openingSnapshots = $this->resolveOpeningBalances($companyId, $request->financial_year_id);

        $rows = [];
        $totalIncome = 0;
        $totalExpense = 0;

        // Group rows — values are 0, frontend aggregates from children
        foreach ($groups as $group) {
            $rows[] = [
                'account_id' => $group->id,
                'name' => $group->name,
                'code' => $group->code ?? '',
                'type' => $group->type,
                'parent_id' => $group->parent_id,
                'is_group' => true,
                'amount' => 0,
            ];
        }

        // Ledger rows
        foreach ($ledgers as $ledger) {
            $txn = $totals[$ledger->id] ?? null;
            $debit = (float) ($txn->total_debit ?? 0);
            $credit = (float) ($txn->total_credit ?? 0);

            [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);

            $totalDebit = $openingDebit + $debit;
            $totalCredit = $openingCredit + $credit;

            $groupType = $ledger->group?->type;

            if ($groupType === 'income') {
                $amount = $totalCredit - $totalDebit; // income = net credit
                $totalIncome += $amount;
            } else {
                $amount = $totalDebit - $totalCredit; // expense = net debit
                $totalExpense += $amount;
            }

            $rows[] = [
                'account_id' => $ledger->id,
                'name' => $ledger->name,
                'code' => $ledger->group?->code ?? '',
                'type' => $groupType ?? 'expense',
                'parent_id' => $ledger->group_id, // ledger's parent = its accounting group
                'is_group' => false,
                'amount' => round($amount, 2),
            ];
        }

        // ── Stock Valuation ────────────────────────────────────────────────────
        // Sales entries store value as positive (selling price), so we cannot
        // use SUM(value) directly. We use SUM(quantity) × item.purchase_price
        // per item to get the cost-based stock value.

        [$openingStockValue, $closingStockValue] = $this->calcStockValues($companyId, $dateFrom, $dateTo);

        // Net P&L in Tally format:
        //   Gross = (Sales + Closing Stock) − (Purchases + Opening Stock + Direct Exp)
        //   Net   = Gross + Indirect Income − Indirect Expenses
        // Simplified: Net = totalIncome + closingStock − totalExpense − openingStock
        $netProfitLoss = $totalIncome - $totalExpense + $closingStockValue - $openingStockValue;

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_income' => round($totalIncome, 2),
                'total_expense' => round($totalExpense, 2),
                'opening_stock' => round($openingStockValue, 2),
                'closing_stock' => round($closingStockValue, 2),
                'net_profit_loss' => round($netProfitLoss, 2),
                'is_profit' => $netProfitLoss >= 0,
            ],
        ]);
    }

    /**
     * Cash Book — transactions of the Cash ledger.
     */
    public function cashBook(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        $ledger = Ledger::with('group')
            ->where('company_id', $companyId)
            ->where('system_key', 'cash')
            ->first();

        if (! $ledger) {
            return response()->json([
                'ledger' => null,
                'data' => [],
                'closing_balance' => 0,
            ]);
        }

        return response()->json($this->buildLedgerBook($companyId, $ledger, $dateFrom, $dateTo, $request->financial_year_id));
    }

    /**
     * Bank Book — transactions of all (or a specific) bank account ledger(s).
     */
    public function bankBook(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        // Fetch all bank account ledgers
        $banks = Ledger::whereHas('group', function ($q) use ($companyId) {
            $q->where('company_id', $companyId)->where('system_key', 'bank_account');
        })
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get(['id', 'name']);

        $selectedLedger = null;
        $data = [];
        $closingBalance = 0;

        if ($banks->isNotEmpty()) {
            $ledgerId = $request->ledger_id ?? $banks->first()->id;
            $selectedLedger = Ledger::with('group')
                ->where('company_id', $companyId)
                ->findOrFail($ledgerId);

            $book = $this->buildLedgerBook($companyId, $selectedLedger, $dateFrom, $dateTo, $request->financial_year_id);
            $data = $book['data'];
            $closingBalance = $book['closing_balance'];
            $selectedLedger = $book['ledger'];
        }

        return response()->json([
            'banks' => $banks,
            'selected_ledger' => $selectedLedger,
            'data' => $data,
            'closing_balance' => $closingBalance,
        ]);
    }

    /**
     * Day Book — all posted vouchers for a date range, with their lines.
     */
    public function dayBook(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $companyId = $request->user()->company_id;
        [$dateFrom, $dateTo] = $this->resolveDateRange($request);

        $query = Voucher::with(['lines.ledger'])
            ->where('company_id', $companyId)
            ->where('is_posted', true)
            ->orderByDesc('voucher_date')
            ->orderByDesc('created_at');

        if ($dateFrom && $dateTo) {
            $query->where('voucher_date', '>=', $dateFrom)
                ->where('voucher_date', '<=', $dateTo);
        }

        $vouchers = $query->get();

        $totalDebit = 0;
        $totalCredit = 0;
        $rows = [];

        foreach ($vouchers as $voucher) {
            $voucherDebit = 0;
            $voucherCredit = 0;
            $lines = [];

            foreach ($voucher->lines as $line) {
                $dr = (float) $line->debit;
                $cr = (float) $line->credit;
                $voucherDebit += $dr;
                $voucherCredit += $cr;

                $lines[] = [
                    'ledger_name' => $line->ledger?->name ?? '—',
                    'narration' => $line->narration,
                    'debit' => round($dr, 2),
                    'credit' => round($cr, 2),
                ];
            }

            $totalDebit += $voucherDebit;
            $totalCredit += $voucherCredit;

            $rows[] = [
                'voucher_id' => $voucher->id,
                'voucher_number' => $voucher->voucher_number,
                'voucher_date' => $voucher->voucher_date,
                'created_at' => $voucher->created_at?->toIso8601String(),
                'voucher_type' => $voucher->voucher_type,
                'narration' => $voucher->narration,
                'lines' => $lines,
                'total_debit' => round($voucherDebit, 2),
                'total_credit' => round($voucherCredit, 2),
            ];
        }

        return response()->json([
            'data' => $rows,
            'summary' => [
                'total_debit' => round($totalDebit, 2),
                'total_credit' => round($totalCredit, 2),
            ],
        ]);
    }

    /**
     * Shared helper — build ledger book (opening + transactions + closing).
     */
    private function buildLedgerBook(string $companyId, Ledger $ledger, ?string $dateFrom, ?string $dateTo, ?string $financialYearId = null): array
    {
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->where('voucher_lines.ledger_id', $ledger->id);

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $entries = $query->select(
            'vouchers.id as voucher_id',
            'vouchers.voucher_number',
            'vouchers.voucher_date',
            'vouchers.voucher_type',
            'vouchers.narration as entry_narration',
            'voucher_lines.debit',
            'voucher_lines.credit',
            'voucher_lines.narration as line_narration'
        )
            ->orderBy('vouchers.voucher_date')
            ->orderBy('vouchers.created_at')
            ->get();

        $openingSnapshots = $this->resolveOpeningBalances($companyId, $financialYearId);
        [$openingDebit, $openingCredit] = $this->resolveLedgerOpening($ledger, $openingSnapshots);
        $runningBalance = $openingDebit - $openingCredit;

        $rows = [];
        foreach ($entries as $entry) {
            $debit = (float) $entry->debit;
            $credit = (float) $entry->credit;
            $runningBalance += ($debit - $credit);

            $rows[] = [
                'voucher_id' => $entry->voucher_id,
                'voucher_number' => $entry->voucher_number,
                'voucher_date' => $entry->voucher_date,
                'voucher_type' => $entry->voucher_type,
                'narration' => $entry->line_narration ?? $entry->entry_narration,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round($runningBalance, 2),
            ];
        }

        return [
            'ledger' => [
                'id' => $ledger->id,
                'name' => $ledger->name,
                'group_name' => $ledger->group?->name,
                'opening_debit' => round($openingDebit, 2),
                'opening_credit' => round($openingCredit, 2),
            ],
            'data' => $rows,
            'closing_balance' => round($runningBalance, 2),
        ];
    }

    /**
     * Party Ledger — all transactions for a specific party.
     */
    public function partyLedger(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Voucher::class);

        $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
        ]);

        $companyId = $request->user()->company_id;
        $party = Party::findOrFail($request->party_id);

        // Collect all ledger IDs for this party
        $ledgerIds = array_filter([
            $party->debtor_ledger_id,
            $party->creditor_ledger_id,
        ]);

        if (empty($ledgerIds)) {
            return response()->json(['data' => [], 'opening_balance' => 0, 'closing_balance' => 0]);
        }

        $fyId = $request->financial_year_id;
        $dateFrom = null;
        $dateTo = null;
        if ($fyId) {
            $fy = FinancialYear::find($fyId);
            if ($fy) {
                $dateFrom = $fy->start_date . 'T00:00:00.000Z';
                $dateTo   = $fy->end_date   . 'T23:59:59.999Z';
            }
        }

        // Get all journal lines for this party's ledger(s)
        $query = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->whereIn('voucher_lines.ledger_id', $ledgerIds);

        if ($dateFrom && $dateTo) {
            $query->where('vouchers.voucher_date', '>=', $dateFrom)
                ->where('vouchers.voucher_date', '<=', $dateTo);
        }

        $entries = $query->select(
            'vouchers.voucher_number',
            'vouchers.voucher_date',
            'vouchers.voucher_type',
            'vouchers.narration as entry_narration',
            'voucher_lines.debit',
            'voucher_lines.credit',
            'voucher_lines.narration as line_narration'
        )
            ->orderBy('vouchers.voucher_date')
            ->orderBy('vouchers.created_at')
            ->get();

        // Calculate running balance — use previous FY snapshot if available
        $openingSnapshots  = $this->resolveOpeningBalances($companyId, $fyId);
        $primaryLedgerId   = $party->debtor_ledger_id ?? $party->creditor_ledger_id;
        $snap              = $openingSnapshots->get($primaryLedgerId);

        if ($snap) {
            $openingBalance = $snap->balance_type === 'dr'
                ? (float) $snap->closing_balance
                : -(float) $snap->closing_balance;
        } else {
            $openingBalance = (float) $party->opening_balance;
            if ($party->balance_type === 'cr') {
                $openingBalance = -$openingBalance;
            }
        }

        $runningBalance = $openingBalance;
        $rows = [];

        foreach ($entries as $entry) {
            $debit = (float) $entry->debit;
            $credit = (float) $entry->credit;
            $runningBalance += ($debit - $credit);

            $rows[] = [
                'voucher_number' => $entry->voucher_number,
                'voucher_date' => $entry->voucher_date,
                'voucher_type' => $entry->voucher_type,
                'narration' => $entry->line_narration ?? $entry->entry_narration,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round($runningBalance, 2),
            ];
        }

        return response()->json([
            'data' => $rows,
            'party' => [
                'id' => $party->id,
                'name' => $party->name,
                'type' => $party->type,
            ],
            'opening_balance' => round($openingBalance, 2),
            'closing_balance' => round($runningBalance, 2),
        ]);
    }

    /**
     * Map of friendly subject_type keys → FQCN.
     * Used to filter and to surface a clean module name on the FE.
     */
    private const AUDIT_SUBJECT_MAP = [
        'sales_invoice'    => \App\Models\SalesInvoice::class,
        'sales_order'      => \App\Models\SalesOrder::class,
        'sales_return'     => \App\Models\SalesReturn::class,
        'purchase_invoice' => \App\Models\PurchaseInvoice::class,
        'purchase_order'   => \App\Models\PurchaseOrder::class,
        'purchase_return'  => \App\Models\PurchaseReturn::class,
        'payment_receipt'  => \App\Models\PaymentReceipt::class,
        'voucher'          => \App\Models\Voucher::class,
        'item'             => \App\Models\Item::class,
        'item_group'       => \App\Models\ItemGroup::class,
        'unit'             => \App\Models\Unit::class,
        'batch'            => \App\Models\Batch::class,
        'party'            => \App\Models\Party::class,
        'ledger'           => \App\Models\Ledger::class,
        'accounting_group' => \App\Models\AccountingGroup::class,
        'branch'           => \App\Models\Branch::class,
        'godown'           => \App\Models\Godown::class,
        'financial_year'   => \App\Models\FinancialYear::class,
        'company'          => \App\Models\Company::class,
        'user'             => \App\Models\User::class,
    ];

    /**
     * Audit Trail — paginated list of activity_log entries scoped to the current company.
     */
    public function auditTrail(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Activity::class);

        [$dateFrom, $dateTo] = $this->resolveDateRange($request);
        $perPage = (int) min($request->input('per_page', 50), 200);

        $query = Activity::query()
            ->with('causer:id,name,email')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($dateFrom && $dateTo) {
            $query->where('created_at', '>=', $dateFrom)
                ->where('created_at', '<=', $dateTo);
        }

        if ($request->filled('causer_id')) {
            $query->where('causer_id', $request->causer_id);
        }

        if ($request->filled('subject_type')) {
            $key = $request->subject_type;
            if (isset(self::AUDIT_SUBJECT_MAP[$key])) {
                $query->where('subject_type', self::AUDIT_SUBJECT_MAP[$key]);
            }
        }

        if ($request->filled('event')) {
            $query->where('event', $request->event);
        }

        if ($request->filled('search')) {
            $term = '%'.$request->search.'%';
            $query->where(function ($q) use ($term) {
                $q->where('description', 'like', $term)
                    ->orWhere('properties', 'like', $term);
            });
        }

        $page = $query->paginate($perPage);

        // Build a friendly-key reverse map FQCN → key for output
        $typeKeyByClass = array_flip(self::AUDIT_SUBJECT_MAP);

        // Resolve subject labels in batch per type to avoid N+1.
        $idsByClass = [];
        foreach ($page->items() as $row) {
            if ($row->subject_type && $row->subject_id) {
                $idsByClass[$row->subject_type][] = $row->subject_id;
            }
        }
        $labelsByClass = [];
        foreach ($idsByClass as $class => $ids) {
            if (! class_exists($class)) {
                continue;
            }
            $field = $this->subjectLabelField($class);
            try {
                $labelsByClass[$class] = $class::withoutGlobalScopes()
                    ->whereIn('id', array_unique($ids))
                    ->pluck($field, 'id')
                    ->toArray();
            } catch (\Throwable $e) {
                $labelsByClass[$class] = [];
            }
        }

        $items = collect($page->items())->map(function ($row) use ($typeKeyByClass, $labelsByClass) {
            $class = $row->subject_type;
            $label = null;
            if ($class && isset($labelsByClass[$class][$row->subject_id])) {
                $label = $labelsByClass[$class][$row->subject_id];
            }

            return [
                'id'                 => $row->id,
                'created_at'         => $row->created_at?->toIso8601String(),
                'event'              => $row->event,
                'log_name'           => $row->log_name,
                'description'        => $row->description,
                'subject_type'       => $class ? ($typeKeyByClass[$class] ?? class_basename($class)) : null,
                'subject_type_class' => $class,
                'subject_id'         => $row->subject_id,
                'subject_label'      => $label,
                'causer'             => $row->causer ? [
                    'id'    => $row->causer->id,
                    'name'  => $row->causer->name,
                    'email' => $row->causer->email,
                ] : null,
                'properties'         => $row->properties,
                'batch_uuid'         => $row->batch_uuid,
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    /**
     * Audit Trail filter options — users in this company + supported subject_type keys.
     */
    public function auditTrailFilters(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Activity::class);

        $companyId = $request->user()->company_id;

        $users = User::where('company_id', $companyId)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $subjectTypes = collect(self::AUDIT_SUBJECT_MAP)
            ->keys()
            ->map(fn ($key) => [
                'key'   => $key,
                'label' => str(str_replace('_', ' ', $key))->title()->toString(),
            ])
            ->values();

        return response()->json([
            'users'         => $users,
            'subject_types' => $subjectTypes,
            'events'        => ['created', 'updated', 'deleted'],
        ]);
    }

    /**
     * Best-effort label field per subject class.
     */
    private function subjectLabelField(string $class): string
    {
        return match ($class) {
            \App\Models\SalesInvoice::class    => 'invoice_number',
            \App\Models\PurchaseInvoice::class => 'invoice_number',
            \App\Models\SalesOrder::class      => 'order_number',
            \App\Models\PurchaseOrder::class   => 'order_number',
            \App\Models\SalesReturn::class     => 'return_number',
            \App\Models\PurchaseReturn::class  => 'return_number',
            \App\Models\PaymentReceipt::class  => 'receipt_number',
            \App\Models\Voucher::class         => 'voucher_number',
            \App\Models\Batch::class           => 'batch_number',
            \App\Models\User::class            => 'name',
            default                            => 'name',
        };
    }
}
