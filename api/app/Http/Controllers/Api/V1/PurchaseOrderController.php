<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseOrder;
use App\Models\StockLedger;
use App\Services\AccountingService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PurchaseOrder::class);

        $query = PurchaseOrder::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('po_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->where('po_date', '>=', $d))
            ->when($request->date_to,   fn ($q, $d) => $q->where('po_date', '<=', $d));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'po_number' => $query->orderBy('po_number', $sortOrder),
                'vendor_name' => $query->join('parties', 'purchase_orders.party_id', '=', 'parties.id')->orderBy('parties.name', $sortOrder),
                'po_date' => $query->orderBy('po_date', $sortOrder),
                'grand_total' => $query->orderBy('grand_total', $sortOrder),
                'status' => $query->orderBy('status', $sortOrder),
                default => $query->latest('po_date'),
            };
        } else {
            $query->latest('po_date');
        }

        $this->applyFYFilter($query, $request);

        $orders = $query->paginate($request->per_page ?? 25);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PurchaseOrder::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'po_number' => 'nullable|string|unique:purchase_orders',
            'po_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:po_date',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
        ]);

        $po = DB::transaction(function () use ($validated, $request) {
            // Always resolve financial year from PO date
            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', $validated['po_date'])
                ->whereDate('end_date', '>=', $validated['po_date'])
                ->first();

            if (! $fy) {
                throw ValidationException::withMessages(['po_date' => 'No financial year found for the selected date']);
            }

            $validated['financial_year_id'] = $fy->id;

            // Auto-generate PO number if not provided
            if (empty($validated['po_number'])) {
                $counter = DocumentCounter::where('company_id', $request->user()->company_id)
                    ->where('financial_year_id', $fy->id)
                    ->where('document_type', 'purchase_order')
                    ->first();

                if (! $counter) {
                    throw ValidationException::withMessages(['po_date' => 'Document counter not initialized for this financial year']);
                }

                $nextNumber = $counter->getAndIncrementCounter(
                    $request->user()->company_id,
                    $fy->id,
                    'purchase_order'
                );
                $validated['po_number'] = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
            }

            $po = PurchaseOrder::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $po->lines()->create([
                    ...$line,
                    'taxable_amount' => $taxable,
                    'cgst' => $gstAmt / 2,
                    'sgst' => $gstAmt / 2,
                    'igst' => 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);
            }

            $po->update([
                'total_amount' => $po->lines->sum('taxable_amount'),
                'gst_amount' => $po->lines->sum('cgst') + $po->lines->sum('sgst') + $po->lines->sum('igst'),
                'grand_total' => $po->lines->sum('line_total'),
            ]);

            return $po->load('lines.item');
        });

        return response()->json(['data' => $po], 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('view', $purchaseOrder);

        return response()->json(['data' => $purchaseOrder->load('lines.item', 'party', 'branch')]);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('update', $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft POs can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'sometimes|uuid|exists:parties,id',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $purchaseOrder->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $purchaseOrder]);
    }

    /**
     * Update PO status with business logic.
     *
     * Allowed transitions:
     *   draft → confirmed | cancelled
     *   confirmed → cancelled
     *   partially_received → cancelled
     */
    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('update', $purchaseOrder);

        $validated = $request->validate([
            'status' => 'required|in:draft,confirmed,partially_received,received,cancelled',
        ]);

        $newStatus = $validated['status'];
        $currentStatus = $purchaseOrder->status;

        // Validate allowed transitions
        $allowedTransitions = [
            'draft' => ['confirmed', 'cancelled'],
            'confirmed' => ['cancelled'],
            'partially_received' => ['cancelled'],
            'received' => [],
            'cancelled' => [],
        ];

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $updateData = [
            'status' => $newStatus,
            'updated_by' => $request->user()->id,
        ];

        $purchaseOrder->update($updateData);

        return response()->json([
            'data' => $purchaseOrder->load('lines.item', 'party', 'branch'),
            'message' => "Purchase order status changed to '{$newStatus}'.",
        ]);
    }

    /**
     * Record a partial or full goods receipt against a confirmed PO.
     * Creates a Purchase Invoice for the received quantities and updates po_line.received_quantity.
     * PO status auto-advances to partially_received or received.
     */
    public function receive(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('update', $purchaseOrder);

        if (! in_array($purchaseOrder->status, ['confirmed', 'partially_received'])) {
            return response()->json(['message' => 'PO must be confirmed or partially received to record a receipt'], 422);
        }

        $validated = $request->validate([
            'receipt_date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
            'lines' => 'required|array|min:1',
            'lines.*.po_line_id' => 'required|uuid|exists:po_lines,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
        ]);

        $result = DB::transaction(function () use ($purchaseOrder, $validated, $request) {
            $purchaseOrder->loadMissing('lines.item', 'party');
            $poLinesMap = $purchaseOrder->lines->keyBy('id');

            // Validate per-line quantities against pending balance
            foreach ($validated['lines'] as $n => $input) {
                $poLine = $poLinesMap[$input['po_line_id']] ?? null;
                abort_if(! $poLine, 422, 'Invalid po_line_id');
                $pending = round($poLine->quantity - $poLine->received_quantity, 3);
                if ($input['quantity'] > $pending + 0.001) {
                    throw ValidationException::withMessages([
                        "lines.{$n}.quantity" => ["Cannot receive more than pending quantity ({$pending})."],
                    ]);
                }
            }

            // Determine inter-state from company vs party state codes
            $companyStateCode = $request->user()->company?->state_code;
            $partyStateCode = $purchaseOrder->party?->state_code;
            $isInterState = $companyStateCode && $partyStateCode && $companyStateCode !== $partyStateCode;

            // Resolve financial year for receipt date
            $receiptDate = $validated['receipt_date'] ?? $purchaseOrder->po_date;

            $defaultGodown = Godown::where('company_id', $purchaseOrder->company_id)
                ->where('is_default', true)
                ->first();
            $fyId = $purchaseOrder->financial_year_id;
            // Generate invoice number
            $counter = DocumentCounter::where('company_id', $purchaseOrder->company_id)
                ->where('financial_year_id', $fyId)
                ->where('document_type', 'purchase_invoice')
                ->first();

            if (! $counter) {
                throw ValidationException::withMessages(['receipt_date' => 'Document counter not initialized for this financial year']);
            }

            $nextNumber = $counter->getAndIncrementCounter($purchaseOrder->company_id, $fyId, 'purchase_invoice');
            $invoiceNumber = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

            // Create the purchase invoice
            $invoice = PurchaseInvoice::create([
                'company_id' => $purchaseOrder->company_id,
                'financial_year_id' => $fyId,
                'party_id' => $purchaseOrder->party_id,
                'branch_id' => $purchaseOrder->branch_id,
                'purchase_order_id' => $purchaseOrder->id,
                'godown_id' => $defaultGodown?->id,
                'invoice_number' => $invoiceNumber,
                'invoice_date' => $receiptDate,
                'is_inter_state' => $isInterState,
                'status' => 'confirmed',
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            $inputLines = collect($validated['lines'])->keyBy('po_line_id');

            foreach ($purchaseOrder->lines as $poLine) {
                $input = $inputLines[$poLine->id] ?? null;
                if (! $input || $input['quantity'] <= 0) {
                    continue;
                }

                $qty = $input['quantity'];
                // Proportional taxable amount to preserve original discount
                $taxable = round(($qty / $poLine->quantity) * $poLine->taxable_amount, 2);
                $gstAmt = round($taxable * $poLine->gst_rate / 100, 2);
                $cgst = $isInterState ? 0 : round($gstAmt / 2, 2);
                $sgst = $isInterState ? 0 : $gstAmt - $cgst;
                $igst = $isInterState ? $gstAmt : 0;
                $lineTotal = $taxable + $gstAmt;

                $invoice->lines()->create([
                    'item_id' => $poLine->item_id,
                    'godown_id' => $defaultGodown?->id,
                    'quantity' => $qty,
                    'rate' => $poLine->rate,
                    'discount_percent' => $poLine->discount_percent,
                    'taxable_amount' => $taxable,
                    'gst_rate' => $poLine->gst_rate,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'line_total' => $lineTotal,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                StockLedger::create([
                    'company_id' => $purchaseOrder->company_id,
                    'item_id' => $poLine->item_id,
                    'godown_id' => $defaultGodown?->id,
                    'type' => 'purchase',
                    'date' => $receiptDate,
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => $qty,
                    'rate' => $poLine->rate,
                    'value' => $qty * $poLine->rate,
                    'narration' => "Received from PO #{$purchaseOrder->po_number}",
                    'created_by' => $request->user()->id,
                ]);

                $poLine->increment('received_quantity', $qty);
            }

            // Update invoice totals
            $invoice->refresh();
            $invoice->update([
                'total_amount' => $invoice->lines->sum('taxable_amount'),
                'taxable_amount' => $invoice->lines->sum('taxable_amount'),
                'cgst_total' => $invoice->lines->sum('cgst'),
                'sgst_total' => $invoice->lines->sum('sgst'),
                'igst_total' => $invoice->lines->sum('igst'),
                'grand_total' => $invoice->lines->sum('line_total'),
                'balance_due' => $invoice->lines->sum('line_total'),
            ]);

            // Post journal entry
            app(AccountingService::class)->postPurchaseInvoice($invoice, $request->user()->id);

            // Auto-advance PO status
            $purchaseOrder->refresh();
            $allReceived = $purchaseOrder->lines->every(fn ($l) => $l->received_quantity >= $l->quantity);
            $purchaseOrder->update(['status' => $allReceived ? 'received' : 'partially_received']);

            return [$purchaseOrder->load('lines.item', 'party', 'branch'), $invoice];
        });

        [$updatedPo, $invoice] = $result;

        return response()->json([
            'data' => $updatedPo,
            'invoice' => $invoice->load('lines.item'),
            'message' => "Items received. PO status: {$updatedPo->status}.",
        ], 201);
    }

    public function destroy(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->authorize('delete', $purchaseOrder);

        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft POs can be deleted'], 422);
        }

        $purchaseOrder->delete();

        return response()->json(['message' => 'Purchase order deleted']);
    }
}
