<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\DocumentCounter;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\SalesInvoice;
use App\Models\StockLedger;
use App\Models\ThermalTemplate;
use App\Models\Voucher;
use App\Services\AccountingService;
use App\Services\InvoicePdfService;
use App\Services\ThermalTemplateRenderer;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SalesInvoiceController extends Controller
{
    use FiltersByFinancialYear;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', SalesInvoice::class);

        $query = SalesInvoice::with('party', 'branch')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('invoice_number', 'like', "%{$s}%"))
            ->when($request->date_from, fn ($q, $d) => $q->where('invoice_date', '>=', $d))
            ->when($request->date_to,   fn ($q, $d) => $q->where('invoice_date', '<=', $d));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'invoice_number' => $query->orderBy('sales_invoices.invoice_number', $sortOrder),
                'customer' => $query->join('parties', 'sales_invoices.party_id', '=', 'parties.id')->orderBy('parties.name', $sortOrder),
                'invoice_date' => $query->orderBy('sales_invoices.invoice_date', $sortOrder),
                'grand_total' => $query->orderBy('sales_invoices.grand_total', $sortOrder),
                'balance_due' => $query->orderBy('sales_invoices.balance_due', $sortOrder),
                'status' => $query->orderBy('sales_invoices.status', $sortOrder),
                default => $query->latest('sales_invoices.invoice_date'),
            };
        } else {
            $query->latest('sales_invoices.invoice_date');
        }

        // $this->applyFYFilter($query, $request);

        $invoices = $query->paginate($request->per_page ?? 25);

        return response()->json($invoices);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', SalesInvoice::class);

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'sales_order_id' => 'nullable|uuid|exists:sales_orders,id',
            'invoice_number' => 'nullable|string|unique:sales_invoices',
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

            // Always resolve financial year from invoice date
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
                    ->where('document_type', 'sales_invoice')
                    ->first();

                if (! $counter) {
                    throw ValidationException::withMessages(['invoice_date' => 'Document counter not initialized for this financial year']);
                }

                $nextNumber = $counter->getAndIncrementCounter(
                    $request->user()->company_id,
                    $fy->id,
                    'sales_invoice'
                );
                $validated['invoice_number'] = $counter->prefix.'-'.str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
            }

            $invoice = SalesInvoice::create([
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

                // Stock ledger entry — always in base units (negative = stock out)
                StockLedger::create([
                    'company_id' => $request->user()->company_id,
                    'item_id' => $line['item_id'],
                    'batch_id' => $line['batch_id'] ?? null,
                    'godown_id' => $line['godown_id'],
                    'type' => 'sale',
                    'date' => $validated['invoice_date'],
                    'reference_type' => SalesInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => -$baseQuantity,
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

            // Auto-post journal entry for sales
            $invoice->refresh();
            app(AccountingService::class)->postSalesInvoice($invoice, $request->user()->id);

            return $invoice->load('lines.item', 'party');
        });

        return response()->json(['data' => $invoice], 201);
    }

    public function show(SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('view', $salesInvoice);

        return response()->json([
            'data' => $salesInvoice->load('lines.item', 'lines.batch', 'party', 'branch', 'godown'),
        ]);
    }

    public function update(Request $request, SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('update', $salesInvoice);

        if ($salesInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be edited'], 422);
        }

        $validated = $request->validate([
            'party_id' => 'required|uuid|exists:parties,id',
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'sales_order_id' => 'nullable|uuid|exists:sales_orders,id',
            'invoice_number' => ['nullable', 'string', Rule::unique('sales_invoices', 'invoice_number')->ignore($salesInvoice->id)],
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

        $salesInvoice = DB::transaction(function () use ($validated, $salesInvoice, $request) {
            $isInterState = $validated['is_inter_state'] ?? false;

            // Re-resolve financial year in case invoice_date changed
            $fy = FinancialYear::where('company_id', $request->user()->company_id)
                ->whereDate('start_date', '<=', $validated['invoice_date'])
                ->whereDate('end_date', '>=', $validated['invoice_date'])
                ->first();

            $salesInvoice->update([
                'party_id' => $validated['party_id'],
                'branch_id' => $validated['branch_id'] ?? null,
                'sales_order_id' => $validated['sales_order_id'] ?? null,
                'invoice_number' => $validated['invoice_number'],
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'] ?? null,
                'is_inter_state' => $isInterState,
                'notes' => $validated['notes'] ?? null,
                'financial_year_id' => $fy?->id,
                'updated_by' => $request->user()->id,
            ]);

            $salesInvoice->lines()->delete();
            StockLedger::where('reference_type', SalesInvoice::class)
                ->where('reference_id', $salesInvoice->id)
                ->delete();

            foreach ($validated['lines'] as $line) {
                $conversionFactor = (float) ($line['conversion_factor'] ?? 1.0);
                $baseQuantity = $line['quantity'] * $conversionFactor;
                $taxable = ($baseQuantity * $line['rate']) * (1 - ($line['discount_percent'] ?? 0) / 100);
                $gstAmt = $taxable * $line['gst_rate'] / 100;

                $salesInvoice->lines()->create([
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
                    'type' => 'sale',
                    'date' => $validated['invoice_date'],
                    'reference_type' => SalesInvoice::class,
                    'reference_id' => $salesInvoice->id,
                    'quantity' => -$baseQuantity,
                    'rate' => $line['rate'],
                    'value' => $baseQuantity * $line['rate'],
                    'created_by' => $request->user()->id,
                ]);
            }

            $salesInvoice->load('lines');

            $salesInvoice->update([
                'total_amount' => $salesInvoice->lines->sum('taxable_amount'),
                'taxable_amount' => $salesInvoice->lines->sum('taxable_amount'),
                'cgst_total' => $salesInvoice->lines->sum('cgst'),
                'sgst_total' => $salesInvoice->lines->sum('sgst'),
                'igst_total' => $salesInvoice->lines->sum('igst'),
                'grand_total' => $salesInvoice->lines->sum('line_total'),
                'balance_due' => $salesInvoice->lines->sum('line_total'),
            ]);

            // Delete old voucher(s) for this draft invoice and re-post with updated amounts
            Voucher::where('reference_type', SalesInvoice::class)
                ->where('reference_id', $salesInvoice->id)
                ->each(function ($voucher) {
                    $voucher->lines()->delete();
                    $voucher->delete();
                });

            $salesInvoice->refresh();
            app(AccountingService::class)->postSalesInvoice($salesInvoice, $request->user()->id);

            return $salesInvoice->load('lines.item', 'party', 'branch');
        });

        return response()->json(['data' => $salesInvoice]);
    }

    /**
     * Update Sales Invoice status with business logic.
     *
     * Allowed transitions:
     *   draft → confirmed | cancelled
     *   confirmed → cancelled
     *
     * On confirm: creates stock ledger entries (stock OUT) for each line.
     */
    public function updateStatus(Request $request, SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('update', $salesInvoice);

        $validated = $request->validate([
            'status' => 'required|in:draft,confirmed,cancelled',
        ]);

        $newStatus = $validated['status'];
        $currentStatus = $salesInvoice->status;

        $allowedTransitions = [
            'draft' => ['confirmed', 'cancelled'],
            'confirmed' => ['cancelled'],
            'cancelled' => [],
        ];

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $result = DB::transaction(function () use ($salesInvoice, $newStatus, $request) {
            $updateData = [
                'status' => $newStatus,
                'updated_by' => $request->user()->id,
            ];

            // Backfill financial_year_id on confirm if missing
            if ($newStatus === 'confirmed' && ! $salesInvoice->financial_year_id) {
                $fy = FinancialYear::where('company_id', $salesInvoice->company_id)
                    ->whereDate('start_date', '<=', $salesInvoice->invoice_date)
                    ->whereDate('end_date', '>=', $salesInvoice->invoice_date)
                    ->first();

                if ($fy) {
                    $updateData['financial_year_id'] = $fy->id;
                }
            }

            $salesInvoice->update($updateData);

            // On confirm → create stock ledger entries (stock out) + journal entry
            if ($newStatus === 'confirmed') {
                $salesInvoice->loadMissing('lines');

                $defaultGodown = Godown::where('company_id', $salesInvoice->company_id)
                    ->where('is_default', true)
                    ->first();

                foreach ($salesInvoice->lines as $line) {
                    $baseQuantity = (float) $line->quantity * (float) ($line->conversion_factor ?? 1.0);
                    StockLedger::create([
                        'company_id' => $salesInvoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'sale',
                        'date' => $salesInvoice->invoice_date,
                        'reference_type' => SalesInvoice::class,
                        'reference_id' => $salesInvoice->id,
                        'quantity' => -$baseQuantity,
                        'rate' => $line->rate,
                        'value' => $baseQuantity * $line->rate,
                        'narration' => "Invoice #{$salesInvoice->invoice_number} confirmed",
                        'created_by' => $request->user()->id,
                    ]);
                }

                // Auto-post journal entry
                $salesInvoice->refresh();
                app(AccountingService::class)->postSalesInvoice($salesInvoice, $request->user()->id);
            }

            // On cancel → reverse stock + delete voucher
            if ($newStatus === 'cancelled' && $currentStatus === 'confirmed') {
                $salesInvoice->loadMissing('lines');

                $defaultGodown = Godown::where('company_id', $salesInvoice->company_id)
                    ->where('is_default', true)
                    ->first();

                foreach ($salesInvoice->lines as $line) {
                    $baseQuantity = (float) $line->quantity * (float) ($line->conversion_factor ?? 1.0);
                    StockLedger::create([
                        'company_id' => $salesInvoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'sale_reversal',
                        'date' => $salesInvoice->invoice_date,
                        'reference_type' => SalesInvoice::class,
                        'reference_id' => $salesInvoice->id,
                        'quantity' => $baseQuantity,
                        'rate' => $line->rate,
                        'value' => $baseQuantity * $line->rate,
                        'narration' => "Reversal: Invoice #{$salesInvoice->invoice_number} cancelled",
                        'created_by' => $request->user()->id,
                    ]);
                }

                Voucher::where('reference_type', SalesInvoice::class)
                    ->where('reference_id', $salesInvoice->id)
                    ->each(function ($voucher) {
                        $voucher->lines()->delete();
                        $voucher->delete();
                    });
            }

            return $salesInvoice->load('lines.item', 'party', 'branch');
        });

        return response()->json([
            'data' => $result,
            'message' => "Sales invoice status changed to '{$newStatus}'.",
        ]);
    }

    public function bulkCancel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'uuid|exists:sales_invoices,id',
        ]);

        $invoices = SalesInvoice::whereIn('id', $validated['ids'])
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

                foreach ($invoice->lines as $line) {
                    $baseQty = (float) $line->quantity * (float) ($line->conversion_factor ?? 1.0);
                    StockLedger::create([
                        'company_id' => $invoice->company_id,
                        'item_id' => $line->item_id,
                        'batch_id' => $line->batch_id ?? null,
                        'godown_id' => $line->godown_id ?? $defaultGodown?->id,
                        'type' => 'sale_reversal',
                        'date' => $invoice->invoice_date,
                        'reference_type' => SalesInvoice::class,
                        'reference_id' => $invoice->id,
                        'quantity' => $baseQty,
                        'rate' => $line->rate,
                        'value' => $baseQty * $line->rate,
                        'narration' => "Reversal: Invoice #{$invoice->invoice_number} cancelled",
                        'created_by' => $request->user()->id,
                    ]);
                }

                Voucher::where('reference_type', SalesInvoice::class)
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

    /**
     * Generate and download PDF for a sales invoice.
     */
    public function pdf(Request $request, SalesInvoice $salesInvoice)
    {
        $this->authorize('view', $salesInvoice);

        $templateSlug = $request->query('template');

        $service = app(InvoicePdfService::class);
        $pdf = $service->generate($salesInvoice, $templateSlug);

        // Mark as printed on first download
        if (! $salesInvoice->is_printed) {
            $salesInvoice->update(['is_printed' => true]);
        }

        $filename = "Invoice-{$salesInvoice->invoice_number}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Return rendered HTML for a sales invoice (for browser print).
     */
    public function html(Request $request, SalesInvoice $salesInvoice)
    {
        $this->authorize('view', $salesInvoice);

        $templateSlug = $request->query('template');
        $paperSize = $request->query('paper_size')
            ?? CompanySetting::getValue($salesInvoice->company_id, 'thermal_printer_paper_size', '2inch');

        // Check if using custom thermal template
        if ($templateSlug === 'thermal-custom') {
            $company = $salesInvoice->company ?? Company::find($salesInvoice->company_id);
            $customTemplate = ThermalTemplate::where('company_id', $salesInvoice->company_id)
                ->where('paper_size', $paperSize)
                ->where('is_default', true)
                ->first();

            if ($customTemplate) {
                $renderer = app(ThermalTemplateRenderer::class);
                $html = $renderer->render($customTemplate, $salesInvoice, $company);
            } else {
                // Fall back to built-in thermal template if no custom found
                $service = app(InvoicePdfService::class);
                $html = $service->generateHtml($salesInvoice, 'thermal', $paperSize);
            }
        } else {
            // Use default behavior
            $service = app(InvoicePdfService::class);
            $html = $service->generateHtml($salesInvoice, $templateSlug, $paperSize);
        }

        // Mark as printed on first view
        if (! $salesInvoice->is_printed) {
            $salesInvoice->update(['is_printed' => true]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
        ]);
    }

    public function destroy(SalesInvoice $salesInvoice): JsonResponse
    {
        $this->authorize('delete', $salesInvoice);

        if ($salesInvoice->status !== 'draft') {
            return response()->json(['message' => 'Only draft invoices can be deleted'], 422);
        }

        $salesInvoice->delete();

        return response()->json(['message' => 'Sales invoice deleted']);
    }
}
