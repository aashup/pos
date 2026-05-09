<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RestaurantReportController extends Controller
{
    // ── Sales Summary ──────────────────────────────────────────────────────────

    public function salesSummary(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $companyId = $request->user()->company_id;
        $from      = $request->date_from;
        $to        = $request->date_to;

        $base = DB::table('sales_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereDate('invoice_date', '>=', $from)
            ->whereDate('invoice_date', '<=', $to);

        $totals = (clone $base)->selectRaw(
            'COUNT(*) as total_orders,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as total_revenue,
             COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) as total_tax,
             COALESCE(SUM(COALESCE(discount_amount,0)), 0) as total_discount'
        )->first();

        $avgOrderValue = $totals->total_orders > 0
            ? round($totals->total_revenue / $totals->total_orders, 2)
            : 0;

        $byOrderType = (clone $base)->selectRaw(
            'order_type, COUNT(*) as count,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as revenue'
        )->groupBy('order_type')->get();

        $byPaymentMode = (clone $base)->selectRaw(
            'pos_payment_mode as payment_mode, COUNT(*) as count,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as amount'
        )->groupBy('pos_payment_mode')->get();

        $daily = (clone $base)->selectRaw(
            'DATE(invoice_date) as date, COUNT(*) as count,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as revenue'
        )->groupByRaw('DATE(invoice_date)')
          ->orderByRaw('DATE(invoice_date)')
          ->get();

        return response()->json(['data' => [
            'date_from'       => $from,
            'date_to'         => $to,
            'total_orders'    => (int) $totals->total_orders,
            'total_revenue'   => (float) $totals->total_revenue,
            'total_tax'       => (float) $totals->total_tax,
            'total_discount'  => (float) $totals->total_discount,
            'avg_order_value' => $avgOrderValue,
            'by_order_type'   => $byOrderType,
            'by_payment_mode' => $byPaymentMode,
            'daily'           => $daily,
        ]]);
    }

    // ── Item-Wise Sales ────────────────────────────────────────────────────────

    public function itemWise(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $companyId = $request->user()->company_id;

        $rows = DB::table('sales_invoice_lines as l')
            ->join('sales_invoices as i', 'l.sales_invoice_id', '=', 'i.id')
            ->leftJoin('items as it', 'l.item_id', '=', 'it.id')
            ->where('i.company_id', $companyId)
            ->where('i.status', 'confirmed')
            ->whereDate('i.invoice_date', '>=', $request->date_from)
            ->whereDate('i.invoice_date', '<=', $request->date_to)
            ->selectRaw(
                'l.item_id,
                 COALESCE(it.name, "Unknown") as item_name,
                 SUM(l.quantity) as total_quantity,
                 COALESCE(SUM(l.line_total), 0) as total_revenue,
                 COALESCE(SUM(l.taxable_amount), 0) as taxable_amount,
                 COALESCE(SUM(l.cgst + l.sgst + l.igst), 0) as tax_amount,
                 COUNT(DISTINCT l.sales_invoice_id) as order_count'
            )
            ->groupBy('l.item_id', 'it.name')
            ->orderByDesc('total_revenue')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // ── Day Close ──────────────────────────────────────────────────────────────

    public function dayClose(Request $request): JsonResponse
    {
        $request->validate(['date' => 'required|date']);

        $companyId = $request->user()->company_id;
        $date      = $request->date;

        $base = DB::table('sales_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereDate('invoice_date', $date);

        $totals = (clone $base)->selectRaw(
            'COUNT(*) as total_orders,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as total_revenue,
             COALESCE(SUM(cgst_total + sgst_total), 0) as total_tax,
             COALESCE(SUM(COALESCE(discount_amount,0)), 0) as total_discount'
        )->first();

        // Cancelled for context
        $cancelled = DB::table('sales_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'cancelled')
            ->whereDate('updated_at', $date)
            ->count();

        // Payment mode breakdown — split orders counted per mode they contain
        $paymentRows = (clone $base)->selectRaw(
            'pos_payment_mode,
             COALESCE(SUM(grand_total - COALESCE(discount_amount,0)), 0) as amount'
        )->groupBy('pos_payment_mode')->get();

        $totalCash   = 0; $totalUpi = 0; $totalCard = 0; $totalCredit = 0;
        foreach ($paymentRows as $row) {
            $modes = explode('+', $row->pos_payment_mode ?? 'cash');
            foreach ($modes as $mode) {
                switch (trim($mode)) {
                    case 'cash':   $totalCash   += (float) $row->amount / count($modes); break;
                    case 'upi':    $totalUpi    += (float) $row->amount / count($modes); break;
                    case 'card':   $totalCard   += (float) $row->amount / count($modes); break;
                    case 'credit': $totalCredit += (float) $row->amount / count($modes); break;
                }
            }
        }

        // Top items
        $topItems = DB::table('sales_invoice_lines as l')
            ->join('sales_invoices as i', 'l.sales_invoice_id', '=', 'i.id')
            ->leftJoin('items as it', 'l.item_id', '=', 'it.id')
            ->where('i.company_id', $companyId)
            ->where('i.status', 'confirmed')
            ->whereDate('i.invoice_date', $date)
            ->selectRaw('COALESCE(it.name,"Unknown") as name, SUM(l.quantity) as quantity, SUM(l.line_total) as revenue')
            ->groupBy('l.item_id', 'it.name')
            ->orderByDesc('revenue')
            ->limit(10)
            ->get();

        return response()->json(['data' => [
            'date'             => $date,
            'total_orders'     => (int) $totals->total_orders,
            'total_revenue'    => (float) $totals->total_revenue,
            'total_tax'        => (float) $totals->total_tax,
            'total_discount'   => (float) $totals->total_discount,
            'cancelled_orders' => $cancelled,
            'total_cash'       => round($totalCash, 2),
            'total_upi'        => round($totalUpi, 2),
            'total_card'       => round($totalCard, 2),
            'total_credit'     => round($totalCredit, 2),
            'top_items'        => $topItems,
        ]]);
    }

    // ── GST Summary ───────────────────────────────────────────────────────────

    public function gstSummary(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $companyId = $request->user()->company_id;

        $byRate = DB::table('sales_invoice_lines as l')
            ->join('sales_invoices as i', 'l.sales_invoice_id', '=', 'i.id')
            ->where('i.company_id', $companyId)
            ->where('i.status', 'confirmed')
            ->whereDate('i.invoice_date', '>=', $request->date_from)
            ->whereDate('i.invoice_date', '<=', $request->date_to)
            ->selectRaw(
                'l.gst_rate,
                 SUM(l.taxable_amount) as taxable_amount,
                 SUM(l.cgst) as cgst_total,
                 SUM(l.sgst) as sgst_total,
                 SUM(l.igst) as igst_total,
                 SUM(l.cgst + l.sgst + l.igst) as total_tax'
            )
            ->groupBy('l.gst_rate')
            ->orderBy('l.gst_rate')
            ->get();

        $summary = DB::table('sales_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereDate('invoice_date', '>=', $request->date_from)
            ->whereDate('invoice_date', '<=', $request->date_to)
            ->selectRaw(
                'SUM(taxable_amount) as total_taxable,
                 SUM(cgst_total) as total_cgst,
                 SUM(sgst_total) as total_sgst,
                 SUM(igst_total) as total_igst'
            )->first();

        return response()->json(['data' => [
            'date_from'     => $request->date_from,
            'date_to'       => $request->date_to,
            'by_rate'       => $byRate,
            'total_taxable' => (float) ($summary->total_taxable ?? 0),
            'total_cgst'    => (float) ($summary->total_cgst ?? 0),
            'total_sgst'    => (float) ($summary->total_sgst ?? 0),
            'total_igst'    => (float) ($summary->total_igst ?? 0),
        ]]);
    }

    // ── Payment Mode Report ────────────────────────────────────────────────────

    public function paymentMode(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        $companyId = $request->user()->company_id;

        $rows = DB::table('sales_invoices')
            ->where('company_id', $companyId)
            ->where('status', 'confirmed')
            ->whereDate('invoice_date', '>=', $request->date_from)
            ->whereDate('invoice_date', '<=', $request->date_to)
            ->selectRaw(
                'pos_payment_mode as payment_mode,
                 COUNT(*) as count,
                 SUM(grand_total - COALESCE(discount_amount,0)) as amount'
            )
            ->groupBy('pos_payment_mode')
            ->orderByDesc('amount')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
