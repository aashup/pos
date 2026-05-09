<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\PurchaseInvoice;
use App\Models\StockLedger;
use App\Models\Voucher;
use App\Services\AccountingService;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseInvoiceController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PurchaseInvoice::class);

        $query = PurchaseInvoice::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('invoice_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->where('invoice_date', '>=', $d))
            ->when($request->date_to,   fn ($q, $d) => $q->where('invoice_date', '<=', $d));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'invoice_number' => $query->orderBy('purchase_invoices.invoice_number', $sortOrder),
                'vendor_invoice_number' => $query->orderBy('purchase_invoices.vendor_invoice_number', $sortOrder),
                'vendor' => $query->join('parties', 'purchase_invoices.party_id', '=', 'parties.id')->orderBy('parties.name', $sortOrder),
                'invoice_date' => $query->orderBy('purchase_invoices.invoice_date', $sortOrder),
                'grand_total' => $query->orderBy('purchase_invoices.grand_total', $sortOrder),
                'balance_due' => $query->orderBy('purchase_invoices.balance_due', $sortOrder),
                'status' => $query->orderBy('purchase_invoices.status', $sortOrder),
                default => $query->latest('purchase_invoices.invoice_date'),
            };
        } else {
            $query->latest('purchase_invoices.invoice_date');
        }

        $this->applyFYFilter($query, $request);

        $invoices = $query->paginate($request->per_page ?? 25);

        return response()->json($invoices);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', PurchaseInvoice::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'purchase_order_id' => 'nullable|uuid|exists:purchase_orders,id',
            'invoice_number' => 'nullable|string|unique:purchase_invoices',
            'vendor_invoice_number' => 'nullable|string',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'is_inter_state' => 'boolean',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.batch_id' => 'nullable|uuid|exists:batches,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.unit' => 'nullable|string|max:20',
            'lines.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
            'lines.*.godown_id' => 'nullable|uuid|exists:godowns,id',
        ]);

        $invoice = DB::transaction(function () use ($validated, $request) {
            $isInterState = $validated['is_inter_state'] ?? false;

            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', $validated['invoice_date'])
                ->whereDate('end_date', '>=', $validated['invoice_date'])
                ->first();

            if (! $fy) {
                throw ValidationException::withMessages(['invoice_date' => 'No financial year found for the selected date']);
            }

            $validated['financial_year_id'] = $fy->id;

            // Auto-generate invoice number if not provided
            if (empty($validated['invoice_number'])) {
                $counter = DocumentCounter::where('company_id', $request->user()->company_id)
                    ->where('financial_year_id', $fy->id)
                    ->where('document_type', 'purchase_invoice')
                    ->first();

                if (! $counter) {
                    throw ValidationException::withMessages(['invoice_date' => 'Document counter not initialized for this financial year']);
                }

                $nextNumber = $counter->getAndIncrementCounter(
                    $request->user()->company_id,
                    $fy->id,
                    'purchase_invoice'
                );
                $validated['invoice_number'] = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
            }

            $invoice = PurchaseInvoice::create([
                ...$validated,
                'status' => 'confirmed',
                'created_by' => $request->user()->id,
                'updated_by' => null,
            ]);

            foreach ($validated['lines'] as $line) {
                $conversionFactor = (float) ($line['conversion_factor'] ?? 1.0);
                $baseQuantity = $line['quantity'] * $conversionFactor;
                $taxable = ($baseQuantity * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $invoice->lines()->create([
                    ...$line,
                    'unit' => $line['unit'] ?? null,
                    'conversion_factor' => $conversionFactor,
                    'taxable_amount' => $taxable,
                    'cgst' => $isInterState ? 0 : $gstAmt / 2,
                    'sgst' => $isInterState ? 0 : $gstAmt / 2,
                    'igst' => $isInterState ? $gstAmt : 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                // Stock ledger entry — always in base units
                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'] ?? null,
                    'type' => 'purchase',
                    'date' => $validated['invoice_date'],
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => $baseQuantity,
                    'rate' => $line['rate'],
                    'value' => $baseQuantity * $line['rate'],
                    'created_by' => $request->user()->id,
                ]);
            }

            $invoice->update([
                'total_amount' => $invoice->lines->sum('taxable_amount'),
                'taxable_amount' => $invoice->lines->sum('taxable_amount'),
                'cgst_total' => $invoice->lines->sum('cgst'),
                'sgst_total' => $invoice->lines->sum('sgst'),
                'igst_total' => $invoice->lines->sum('igst'),
                'grand_total' => $invoice->lines->sum('line_total'),
                'balance_due' => $invoice->lines->sum('line_total'),
            ]);

            // Auto-post journal entry for purchase (mandatory — invoice is invalid without it)
            $invoice->refresh();
            $voucher = app(AccountingService::class)->postPurchaseInvoice($invoice, $request->user()->id);

            if (! $voucher) {
                throw new \RuntimeException(
                    'Purchase invoice cannot be saved: journal entry could not be created. '.
                    'Ensure the vendor has a creditor ledger, purchase_account ledger exists, '.
                    'and a financial year covers the invoice date.'
                );
            }

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    public function show(PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('view', $purchaseInvoice);

        return response()->json([
            'data' => $purchaseInvoice->load('lines.item', 'lines.batch', 'party', 'branch', 'godown'),
        ]);
    }

    public function update(Request $request, PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('update', $purchaseInvoice);

        if ($purchaseInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'purchase_order_id' => 'nullable|uuid|exists:purchase_orders,id',
            'invoice_number' => ['nullable', 'string', Rule::unique('purchase_invoices', 'invoice_number')->ignore($purchaseInvoice->id)],
            'vendor_invoice_number' => 'nullable|string',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'is_inter_state' => 'boolean',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.item_id' => 'required|uuid|exists:items,id',
            'lines.*.batch_id' => 'nullable|uuid|exists:batches,id',
            'lines.*.quantity' => 'required|numeric|min:0.001',
            'lines.*.unit' => 'nullable|string|max:20',
            'lines.*.conversion_factor' => 'nullable|numeric|min:0.0001',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'lines.*.gst_rate' => 'required|numeric|min:0',
            'lines.*.godown_id' => 'nullable|uuid|exists:godowns,id',
        ]);

        $purchaseInvoice = DB::transaction(function () use ($validated, $purchaseInvoice, $request) {
            $isInterState = $validated['is_inter_state'] ?? false;

            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', $validated['invoice_date'])
                ->whereDate('end_date', '>=', $validated['invoice_date'])
                ->first();

            $purchaseInvoice->update([
                'party_id' => $validated['party_id'],
                'branch_id' => $validated['branch_id'] ?? null,
                'purchase_order_id' => $validated['purchase_order_id'] ?? null,
                'invoice_number' => $validated['invoice_number'] ?? $purchaseInvoice->invoice_number,
                'vendor_invoice_number' => $validated['vendor_invoice_number'] ?? null,
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'] ?? null,
                'is_inter_state' => $isInterState,
                'notes' => $validated['notes'] ?? null,
                'financial_year_id' => $fy?->id,
                'updated_by' => $request->user()->id,
            ]);

            $purchaseInvoice->lines()->delete();
            StockLedger::where('reference_type', PurchaseInvoice::class)
                ->where('reference_id', $purchaseInvoice->id)
                ->delete();

            foreach ($validated['lines'] as $line) {
                $conversionFactor = (float) ($line['conversion_factor'] ?? 1.0);
                $baseQuantity = $line['quantity'] * $conversionFactor;
                $taxable = ($baseQuantity * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $purchaseInvoice->lines()->create([
                    ...$line,
                    'unit' => $line['unit'] ?? null,
                    'conversion_factor' => $conversionFactor,
                    'taxable_amount' => $taxable,
                    'cgst' => $isInterState ? 0 : $gstAmt / 2,
                    'sgst' => $isInterState ? 0 : $gstAmt / 2,
                    'igst' => $isInterState ? $gstAmt : 0,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $request->user()->id,
                    'updated_by' => null,
                ]);

                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'] ?? null,
                    'type' => 'purchase',
                    'date' => $validated['invoice_date'],
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $purchaseInvoice->id,
                    'quantity' => $baseQuantity,
                    'rate' => $line['rate'],
                    'value' => $baseQuantity * $line['rate'],
                    'created_by' => $request->user()->id,
                ]);
            }

            $purchaseInvoice->load('lines');

            $purchaseInvoice->update([
                'total_amount' => $purchaseInvoice->lines->sum('taxable_amount'),
                'taxable_amount' => $purchaseInvoice->lines->sum('taxable_amount'),
                'cgst_total' => $purchaseInvoice->lines->sum('cgst'),
                'sgst_total' => $purchaseInvoice->lines->sum('sgst'),
                'igst_total' => $purchaseInvoice->lines->sum('igst'),
                'grand_total' => $purchaseInvoice->lines->sum('line_total'),
                'balance_due' => $purchaseInvoice->lines->sum('line_total'),
            ]);

            // Delete old voucher(s) and re-post with updated amounts
            Voucher::where('reference_type', PurchaseInvoice::class)
                ->where('reference_id', $purchaseInvoice->id)
                ->each(function ($voucher) {
                    $voucher->lines()->delete();
                    $voucher->delete();
                });

            $purchaseInvoice->refresh();
            app(AccountingService::class)->postPurchaseInvoice($purchaseInvoice, $request->user()->id);

            return $purchaseInvoice->load('lines.item', 'party', 'branch');
        });

        return response()->json(['data' => $purchaseInvoice]);
    }

    public function destroy(PurchaseInvoice $purchaseInvoice): JsonResponse
    {
        $this->authorize('delete', $purchaseInvoice);

        if ($purchaseInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be deleted'], 422);
        }

        $purchaseInvoice->delete();

        return response()->json(['message' => 'Purchase invoice deleted']);
    }

    public function bulkCancel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'uuid|exists:purchase_invoices,id',
        ]);

        $invoices = PurchaseInvoice::whereIn('id', $validated['ids'])
            ->where('company_id', $request->user()->company_id)
            ->with('lines')
            ->get();

        $cancelled = 0;
        $skipped = 0;

        DB::transaction(function () use ($invoices, $request, &$cancelled, &$skipped) {
            $defaultGodown = Godown::where('company_id', $request->user()->company_id)
                ->where('is_default', true)->first();

            foreach ($invoices as $invoice) {
                if ($invoice->status !== 'confirmed') {
                    $skipped++;

                    continue;
                }

                $invoice->update(['status' => 'cancelled', 'updated_by' => $request->user()->id]);

                // Reverse stock (purchase reversal = deduct what was added)
                foreach ($invoice->lines as $line) {
                    $baseQty = (float) $line->quantity * (float) ($line->conversion_factor ?? 1.0);
                    StockLedger::create([
                        'company_id' => $invoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'purchase_reversal',
                        'date' => $invoice->invoice_date,
                        'reference_type' => PurchaseInvoice::class,
                        'reference_id' => $invoice->id,
                        'quantity' => -$baseQty,
                        'rate' => $line->rate,
                        'value' => $baseQty * $line->rate,
                        'narration' => "Reversal: Invoice #{$invoice->invoice_number} cancelled",
                        'created_by' => $request->user()->id,
                    ]);
                }

                // Delete voucher entries
                Voucher::where('reference_type', PurchaseInvoice::class)
                    ->where('reference_id', $invoice->id)
                    ->each(function ($voucher) {
                        $voucher->lines()->delete();
                        $voucher->delete();
                    });

                $cancelled++;
            }
        });

        return response()->json([
            'message' => "{$cancelled} invoice(s) cancelled.".($skipped ? " {$skipped} skipped (not confirmed)." : ''),
            'cancelled' => $cancelled,
            'skipped' => $skipped,
        ]);
    }
}
