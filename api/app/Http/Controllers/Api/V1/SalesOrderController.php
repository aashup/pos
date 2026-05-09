<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\SalesInvoice;
use App\Models\SalesOrder;
use App\Models\StockLedger;
use App\Services\AccountingService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesOrderController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', SalesOrder::class);

        $query = SalesOrder::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('so_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->where('so_date', '>=', $d))
            ->when($request->date_to,   fn ($q, $d) => $q->where('so_date', '<=', $d));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'so_number' => $query->orderBy('sales_orders.so_number', $sortOrder),
                'customer' => $query->join('parties', 'sales_orders.party_id', '=', 'parties.id')->orderBy('parties.name', $sortOrder),
                'so_date' => $query->orderBy('sales_orders.so_date', $sortOrder),
                'grand_total' => $query->orderBy('sales_orders.grand_total', $sortOrder),
                'status' => $query->orderBy('sales_orders.status', $sortOrder),
                default => $query->latest('sales_orders.so_date'),
            };
        } else {
            $query->latest('sales_orders.so_date');
        }

        $this->applyFYFilter($query, $request);

        $orders = $query->paginate($request->per_page ?? 25);

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', SalesOrder::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'so_number' => 'nullable|string|unique:sales_orders',
            'so_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after_or_equal:so_date',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
        ]);

        $so = DB::transaction(function () use ($validated, $request) {
            // Always resolve financial year from SO date
            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', $validated['so_date'])
                ->whereDate('end_date', '>=', $validated['so_date'])
                ->first();

            if (! $fy) {
                throw ValidationException::withMessages(['so_date' => 'No financial year found for the selected date']);
            }

            $validated['financial_year_id'] = $fy->id;

            // Auto-generate SO number if not provided
            if (empty($validated['so_number'])) {
                $counter = DocumentCounter::where('company_id', $request->user()->company_id)
                    ->where('financial_year_id', $fy->id)
                    ->where('document_type', 'sales_order')
                    ->first();

                if (! $counter) {
                    throw ValidationException::withMessages(['so_date' => 'Document counter not initialized for this financial year']);
                }

                $nextNumber = $counter->getAndIncrementCounter(
                    $request->user()->company_id,
                    $fy->id,
                    'sales_order'
                );
                $validated['so_number'] = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
            }

            $so = SalesOrder::create([
                ...$validated,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $taxable = ($line['quantity'] * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $so->lines()->create([
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

            $so->update([
                'total_amount' => $so->lines->sum('taxable_amount'),
                'gst_amount' => $so->lines->sum('cgst') + $so->lines->sum('sgst') + $so->lines->sum('igst'),
                'grand_total' => $so->lines->sum('line_total'),
            ]);

            return $so->load('lines.item');
        });

        return response()->json(['data' => $so], 201);
    }

    public function show(SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('view', $salesOrder);

        return response()->json(['data' => $salesOrder->load('lines.item', 'party', 'branch')]);
    }

    public function update(Request $request, SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('update', $salesOrder);

        if ($salesOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft SOs can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'sometimes|uuid|exists:parties,id',
            'expected_delivery_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $salesOrder->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $salesOrder]);
    }

    /**
     * Update SO status with business logic.
     *
     * Allowed transitions:
     *   draft → confirmed | cancelled
     *   confirmed → partially_delivered | delivered | cancelled
     *   partially_delivered → delivered | cancelled
     *
     * On confirm: auto-creates a sales invoice from SO lines + stock out.
     */
    public function updateStatus(Request $request, SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('update', $salesOrder);

        $validated = $request->validate([
            'status' => 'required|in:draft,confirmed,partially_delivered,delivered,cancelled',
        ]);

        $newStatus = $validated['status'];
        $currentStatus = $salesOrder->status;

        $allowedTransitions = [
            'draft' => ['confirmed', 'cancelled'],
            'confirmed' => ['partially_delivered', 'delivered', 'cancelled'],
            'partially_delivered' => ['delivered', 'cancelled'],
            'delivered' => [],
            'cancelled' => [],
        ];

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $result = DB::transaction(function () use ($salesOrder, $newStatus, $request) {
            $updateData = [
                'status' => $newStatus,
                'updated_by' => $request->user()->id,
            ];

            // Backfill financial_year_id on confirm if missing (e.g. manually-numbered SOs)
            if ($newStatus === 'confirmed' && ! $salesOrder->financial_year_id) {
                $fy = FinancialYear::where('company_id', $salesOrder->company_id)
                    ->whereDate('start_date', '<=', $salesOrder->so_date)
                    ->whereDate('end_date', '>=', $salesOrder->so_date)
                    ->first();

                if ($fy) {
                    $updateData['financial_year_id'] = $fy->id;
                }
            }

            $salesOrder->update($updateData);

            // On confirm → auto-create sales invoice from SO lines
            if ($newStatus === 'confirmed') {
                $this->createInvoiceFromSo($salesOrder, $request);
            }

            return $salesOrder->load('lines.item', 'party', 'branch', 'salesInvoices');
        });

        return response()->json([
            'data' => $result,
            'message' => "Sales order status changed to '{$newStatus}'.",
        ]);
    }

    /**
     * Auto-create a sales invoice when SO is confirmed.
     */
    private function createInvoiceFromSo(SalesOrder $so, Request $request): SalesInvoice
    {
        $so->loadMissing('lines', 'party');

        // Determine inter-state from party vs company state codes
        $companyStateCode = $request->user()->company?->state_code;
        $partyStateCode = $so->party?->state_code;
        $isInterState = $companyStateCode && $partyStateCode && $companyStateCode !== $partyStateCode;

        // Get default godown
        $defaultGodown = Godown::where('company_id', $so->company_id)
            ->where('is_default', true)
            ->first();

        // Generate invoice number using DocumentCounter
        $fyId = $so->financial_year_id ?? FinancialYear::where('company_id', $so->company_id)
            ->whereDate('start_date', '<=', now())
            ->whereDate('end_date', '>=', now())
            ->first()?->id;

        if (! $fyId) {
            throw ValidationException::withMessages(['invoice_date' => 'No financial year found for invoice date']);
        }

        $counter = DocumentCounter::where('company_id', $so->company_id)
            ->where('financial_year_id', $fyId)
            ->where('document_type', 'sales_invoice')
            ->first();

        if (! $counter) {
            throw ValidationException::withMessages(['invoice_date' => 'Document counter not initialized']);
        }

        $nextNumber = $counter->getAndIncrementCounter($so->company_id, $fyId, 'sales_invoice');
        $invoiceNumber = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);

        $invoice = SalesInvoice::create([
            'company_id' => $so->company_id,
            'financial_year_id' => $fyId,
            'party_id' => $so->party_id,
            'branch_id' => $so->branch_id,
            'sales_order_id' => $so->id,
            'godown_id' => $defaultGodown?->id,
            'invoice_number' => $invoiceNumber,
            'invoice_date' => $so->so_date,
            'is_inter_state' => $isInterState,
            'status' => 'confirmed',
            'created_by' => $request->user()->id,
            'updated_by' => null,
        ]);

        foreach ($so->lines as $soLine) {
            $taxable = $soLine->taxable_amount;
            $gstAmt = $taxable * $soLine->gst_rate / 100;

            $invoice->lines()->create([
                'item_id' => $soLine->item_id,
                'godown_id' => $defaultGodown?->id,
                'quantity' => $soLine->quantity,
                'rate' => $soLine->rate,
                'discount_percent' => $soLine->discount_percent,
                'taxable_amount' => $taxable,
                'gst_rate' => $soLine->gst_rate,
                'cgst' => $isInterState ? 0 : $gstAmt / 2,
                'sgst' => $isInterState ? 0 : $gstAmt / 2,
                'igst' => $isInterState ? $gstAmt : 0,
                'line_total' => $taxable + $gstAmt,
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            // Stock ledger entry — stock OUT (negative quantity)
            StockLedger::create([
                'company_id' => $so->company_id,
                'item_id' => $soLine->item_id,
                'godown_id' => $defaultGodown?->id,
                'type' => 'sale',
                'reference_type' => SalesInvoice::class,
                'reference_id' => $invoice->id,
                'quantity' => -$soLine->quantity,
                'rate' => $soLine->rate,
                'value' => $soLine->quantity * $soLine->rate,
                'narration' => "Auto from SO #{$so->so_number}",
                'created_by' => $request->user()->id,
                'date' => $so->so_date,
            ]);

            // Mark SO line as fully delivered
            $soLine->update(['delivered_quantity' => $soLine->quantity]);
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

        // Auto-post journal entry for sales
        app(AccountingService::class)->postSalesInvoice($invoice, $request->user()->id);

        return $invoice;
    }

    public function destroy(SalesOrder $salesOrder): JsonResponse
    {
        $this->authorize('delete', $salesOrder);

        if ($salesOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft SOs can be deleted'], 422);
        }

        $salesOrder->delete();

        return response()->json(['message' => 'Sales order deleted']);
    }
}
