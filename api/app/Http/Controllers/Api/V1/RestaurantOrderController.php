<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\KitchenOrderTicket;
use App\Models\SalesInvoice;
use App\Services\AccountingService;
use App\Services\InventoryDeductionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RestaurantOrderController extends Controller
{
    /**
     * List restaurant orders (draft + held + today's confirmed).
     */
    public function index(Request $request): JsonResponse
    {
        $query = SalesInvoice::with('diningTable', 'lines.item')
            ->where('company_id', $request->user()->company_id)
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->order_type, fn ($q, $t) => $q->where('order_type', $t))
            ->when($request->table_id, fn ($q, $id) => $q->where('table_id', $id))
            ->when(! $request->status, fn ($q) => $q->where(function ($q2) {
                $q2->where('status', 'draft')
                    ->orWhere(fn ($q3) => $q3->where('status', 'confirmed')->whereDate('invoice_date', today()));
            }))
            ->latest();

        return response()->json($query->paginate($request->per_page ?? 50));
    }

    /**
     * Open a new restaurant order.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_type' => 'required|in:dine_in,takeaway,delivery',
            'table_id'   => 'nullable|uuid|exists:dining_tables,id',
            'pax'        => 'nullable|integer|min:1',
            'notes'      => 'nullable|string',
        ]);

        $order = DB::transaction(function () use ($validated, $request) {
            if (! empty($validated['table_id'])) {
                $table = DiningTable::where('id', $validated['table_id'])
                    ->where('company_id', $request->user()->company_id)
                    ->firstOrFail();

                if ($table->isOccupied()) {
                    throw ValidationException::withMessages(['table_id' => 'Table is already occupied']);
                }
            }

            $order = SalesInvoice::create([
                'company_id'     => $request->user()->company_id,
                'order_type'     => $validated['order_type'],
                'table_id'       => $validated['table_id'] ?? null,
                'pax'            => $validated['pax'] ?? 1,
                'notes'          => $validated['notes'] ?? null,
                'invoice_date'   => now(),
                'status'         => 'draft',
                'pos_held'       => false,
                'is_inter_state' => false,
                'total_amount'   => 0,
                'discount_amount'=> 0,
                'taxable_amount' => 0,
                'cgst_total'     => 0,
                'sgst_total'     => 0,
                'igst_total'     => 0,
                'grand_total'    => 0,
                'amount_paid'    => 0,
                'balance_due'    => 0,
                'created_by'     => $request->user()->id,
            ]);

            if (! empty($validated['table_id'])) {
                DiningTable::where('id', $validated['table_id'])->update([
                    'status'           => 'occupied',
                    'current_order_id' => $order->id,
                ]);
            }

            return $order->load('diningTable');
        });

        return response()->json(['data' => $order], 201);
    }

    /**
     * Get a single order with all lines, KOTs.
     */
    public function show(SalesInvoice $order): JsonResponse
    {
        return response()->json([
            'data' => $order->load('lines.item', 'diningTable', 'kots.lines.item'),
        ]);
    }

    /**
     * Add items to an open order.
     */
    public function addLines(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Cannot add items to a closed order'], 422);
        }

        $validated = $request->validate([
            'lines'                   => 'required|array|min:1',
            'lines.*.item_id'         => 'required|uuid|exists:items,id',
            'lines.*.quantity'        => 'required|numeric|min:0.01',
            'lines.*.rate'            => 'required|numeric|min:0',
            'lines.*.discount_percent'=> 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate'        => 'required|numeric|min:0',
            'lines.*.notes'           => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($validated, $order, $request) {
            foreach ($validated['lines'] as $line) {
                $discountPct = (float) ($line['discount_percent'] ?? 0);
                $taxable     = $line['quantity'] * $line['rate'] * (1 - $discountPct / 100);
                $gstAmt      = $taxable * $line['gst_rate'] / 100;

                $order->lines()->create([
                    'item_id'          => $line['item_id'],
                    'quantity'         => $line['quantity'],
                    'unit'             => null,
                    'conversion_factor'=> 1.0,
                    'rate'             => $line['rate'],
                    'discount_percent' => $discountPct,
                    'gst_rate'         => $line['gst_rate'],
                    'taxable_amount'   => $taxable,
                    'cgst'             => $gstAmt / 2,
                    'sgst'             => $gstAmt / 2,
                    'igst'             => 0,
                    'line_total'       => $taxable + $gstAmt,
                    'kot_status'       => 'pending',
                    'notes'            => $line['notes'] ?? null,
                    'created_by'       => $request->user()->id,
                ]);
            }

            $this->recalculateTotals($order);
        });

        return response()->json(['data' => $order->load('lines.item')]);
    }

    /**
     * Remove a pending line from an open order.
     */
    public function removeLine(SalesInvoice $order, string $lineId): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Cannot modify a closed order'], 422);
        }

        $line = $order->lines()->findOrFail($lineId);

        if ($line->kot_status !== 'pending') {
            return response()->json(['message' => 'Cannot remove items already sent to kitchen'], 422);
        }

        DB::transaction(function () use ($order, $line) {
            $line->delete();
            $this->recalculateTotals($order);
        });

        return response()->json(['message' => 'Line removed']);
    }

    /**
     * Send all pending items to kitchen (creates a KOT).
     */
    public function generateKot(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Order is not open'], 422);
        }

        $pendingLines = $order->lines()->where('kot_status', 'pending')->with('item')->get();

        if ($pendingLines->isEmpty()) {
            return response()->json(['message' => 'No pending items to send to kitchen'], 422);
        }

        $kot = DB::transaction(function () use ($order, $pendingLines, $request) {
            $kotSeq    = $order->kot_count + 1;
            $kotNumber = 'KOT-' . strtoupper(substr($order->id, -6)) . '-' . $kotSeq;

            $kot = KitchenOrderTicket::create([
                'company_id'       => $request->user()->company_id,
                'sales_invoice_id' => $order->id,
                'kot_number'       => $kotNumber,
                'status'           => 'new',
                'print_count'      => 0,
            ]);

            foreach ($pendingLines as $line) {
                $kot->lines()->create([
                    'item_id'      => $line->item_id,
                    'item_name'    => $line->item?->name ?? 'Item',
                    'variant_name' => null,
                    'quantity'     => $line->quantity,
                    'notes'        => $line->notes,
                    'status'       => 'pending',
                ]);

                $line->update(['kot_status' => 'sent']);
            }

            $order->increment('kot_count');

            return $kot->load('lines');
        });

        return response()->json(['data' => $kot], 201);
    }

    /**
     * Put an order on hold (frees up workflow, table remains occupied).
     */
    public function hold(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Only open orders can be held'], 422);
        }

        $order->update(['pos_held' => true, 'updated_by' => $request->user()->id]);

        return response()->json(['data' => $order, 'message' => 'Order placed on hold']);
    }

    /**
     * Resume a held order.
     */
    public function unhold(Request $request, SalesInvoice $order): JsonResponse
    {
        $order->update(['pos_held' => false, 'updated_by' => $request->user()->id]);

        return response()->json(['data' => $order, 'message' => 'Order resumed']);
    }

    /**
     * Checkout: finalize payment, generate invoice number, post accounting.
     */
    public function checkout(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Order is already closed'], 422);
        }

        $order->loadMissing('lines');

        if ($order->lines->isEmpty()) {
            return response()->json(['message' => 'Cannot checkout an empty order'], 422);
        }

        $validated = $request->validate([
            'payment_mode'    => 'required|in:cash,upi,card,credit,split',
            'amount_tendered' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'notes'           => 'nullable|string',
            // Split payment: array of { mode, amount }
            'split_payments'              => 'required_if:payment_mode,split|array|min:2',
            'split_payments.*.mode'       => 'required|in:cash,upi,card,credit',
            'split_payments.*.amount'     => 'required|numeric|min:0',
            'split_payments.*.tendered'   => 'nullable|numeric|min:0',
        ]);

        $result = DB::transaction(function () use ($validated, $order, $request) {
            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', now())
                ->whereDate('end_date', '>=', now())
                ->first();

            if (! $fy) {
                throw ValidationException::withMessages(['invoice_date' => 'No active financial year found. Please configure one in settings.']);
            }

            $counter = DocumentCounter::where('company_id', $request->user()->company_id)
                ->where('financial_year_id', $fy->id)
                ->where('document_type', 'sales_invoice')
                ->lockForUpdate()
                ->first();

            if (! $counter) {
                throw ValidationException::withMessages(['invoice_number' => 'Sales invoice counter not initialized for this financial year.']);
            }

            $nextNumber    = $counter->next_number;
            $counter->increment('next_number');
            $invoiceNumber = ($counter->prefix ?? 'INV') . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

            $discountAmount = (float) ($validated['discount_amount'] ?? 0);
            $grandTotal     = (float) $order->grand_total - $discountAmount;

            // Resolve primary mode label and amount tendered for split vs single
            $isSplit = $validated['payment_mode'] === 'split';
            if ($isSplit) {
                $splitPayments  = $validated['split_payments'];
                $amountTendered = collect($splitPayments)->sum(fn ($p) => (float) ($p['tendered'] ?? $p['amount']));
                $primaryMode    = collect($splitPayments)->sortByDesc('amount')->first()['mode'];
                $modeLabel      = implode('+', array_column($splitPayments, 'mode'));
            } else {
                $amountTendered = (float) ($validated['amount_tendered'] ?? $grandTotal);
                $primaryMode    = $validated['payment_mode'];
                $modeLabel      = $validated['payment_mode'];
                $splitPayments  = [];
            }
            $changeAmount = max(0, $amountTendered - $grandTotal);

            $order->update([
                'financial_year_id' => $fy->id,
                'invoice_number'    => $invoiceNumber,
                'invoice_date'      => now(),
                'status'            => 'confirmed',
                'pos_held'          => false,
                'pos_payment_mode'  => $modeLabel,
                'discount_amount'   => $discountAmount,
                'amount_paid'       => min($amountTendered, $grandTotal),
                'amount_tendered'   => $amountTendered,
                'change_amount'     => $changeAmount,
                'balance_due'       => 0,
                'notes'             => $validated['notes'] ?? $order->notes,
                'updated_by'        => $request->user()->id,
            ]);

            // Mark all KOTs as served
            KitchenOrderTicket::where('sales_invoice_id', $order->id)
                ->whereNotIn('status', ['served'])
                ->update(['status' => 'served']);

            // Release dining table
            if ($order->table_id) {
                DiningTable::where('id', $order->table_id)->update([
                    'status'           => 'vacant',
                    'current_order_id' => null,
                ]);
            }

            // Recipe-based ingredient deduction
            app(InventoryDeductionService::class)->deductForOrder($order, $request->user()->id);

            // Post accounting journal (will silently skip if no party or ledger configured)
            $order->refresh();
            app(AccountingService::class)->postSalesInvoice($order, $request->user()->id);

            return $order->load('lines.item', 'diningTable');
        });

        return response()->json(['data' => $result]);
    }

    /**
     * Cancel a draft order and release the table.
     */
    public function cancel(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status === 'confirmed') {
            return response()->json(['message' => 'Confirmed orders cannot be cancelled here. Use the billing module.'], 422);
        }

        DB::transaction(function () use ($order, $request) {
            $order->update(['status' => 'cancelled', 'updated_by' => $request->user()->id]);

            if ($order->table_id) {
                DiningTable::where('id', $order->table_id)
                    ->where('current_order_id', $order->id)
                    ->update(['status' => 'vacant', 'current_order_id' => null]);
            }
        });

        return response()->json(['message' => 'Order cancelled']);
    }

    /**
     * Transfer the order to a different table.
     */
    public function transferTable(Request $request, SalesInvoice $order): JsonResponse
    {
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Cannot transfer a closed order'], 422);
        }

        $validated = $request->validate([
            'table_id' => 'required|uuid|exists:dining_tables,id',
        ]);

        DB::transaction(function () use ($validated, $order, $request) {
            $newTable = DiningTable::where('id', $validated['table_id'])
                ->where('company_id', $request->user()->company_id)
                ->firstOrFail();

            if ($newTable->isOccupied()) {
                throw ValidationException::withMessages(['table_id' => 'Target table is already occupied']);
            }

            // Vacate old table
            if ($order->table_id) {
                DiningTable::where('id', $order->table_id)->update([
                    'status'           => 'vacant',
                    'current_order_id' => null,
                ]);
            }

            // Occupy new table
            $newTable->update(['status' => 'occupied', 'current_order_id' => $order->id]);

            $order->update(['table_id' => $validated['table_id'], 'updated_by' => $request->user()->id]);
        });

        return response()->json(['data' => $order->fresh()->load('diningTable')]);
    }

    private function recalculateTotals(SalesInvoice $order): void
    {
        $order->load('lines');
        $order->update([
            'total_amount'   => $order->lines->sum('taxable_amount'),
            'taxable_amount' => $order->lines->sum('taxable_amount'),
            'cgst_total'     => $order->lines->sum('cgst'),
            'sgst_total'     => $order->lines->sum('sgst'),
            'igst_total'     => $order->lines->sum('igst'),
            'grand_total'    => $order->lines->sum('line_total'),
            'balance_due'    => $order->lines->sum('line_total'),
        ]);
    }
}
