<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ThermalTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ThermalTemplateController extends Controller
{
    /**
     * Get all thermal templates for the company.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ThermalTemplate::class);

        $templates = ThermalTemplate::where('company_id', $request->user()->company_id)
            ->orderBy('paper_size')
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 25);

        return response()->json($templates);
    }

    /**
     * Get a single thermal template.
     */
    public function show(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('view', $thermalTemplate);

        return response()->json(['data' => $thermalTemplate]);
    }

    /**
     * Create a new thermal template.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ThermalTemplate::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'html_content' => 'required|string|max:102400', // 100KB limit
            'paper_size' => [
                'required',
                Rule::in(['2inch', '3inch']),
            ],
            'is_default' => 'boolean',
        ]);

        // If setting as default, unset other defaults for this paper size
        if ($validated['is_default'] ?? false) {
            ThermalTemplate::where('company_id', $request->user()->company_id)
                ->where('paper_size', $validated['paper_size'])
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $template = ThermalTemplate::create([
            'company_id' => $request->user()->company_id,
            'created_by' => $request->user()->id,
            ...$validated,
        ]);

        return response()->json(['data' => $template], 201);
    }

    /**
     * Update a thermal template.
     */
    public function update(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'html_content' => 'string|max:102400',
            'paper_size' => [
                Rule::in(['2inch', '3inch']),
            ],
            'is_default' => 'boolean',
        ]);

        // If setting as default, unset other defaults for this paper size
        if ($validated['is_default'] ?? false) {
            ThermalTemplate::where('company_id', $thermalTemplate->company_id)
                ->where('paper_size', $thermalTemplate->paper_size)
                ->where('id', '!=', $thermalTemplate->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $thermalTemplate->update([
            'updated_by' => $request->user()->id,
            ...$validated,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }

    /**
     * Delete a thermal template.
     */
    public function destroy(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('delete', $thermalTemplate);

        // Prevent deletion of last default template for a paper size
        $defaultCount = ThermalTemplate::where('company_id', $thermalTemplate->company_id)
            ->where('paper_size', $thermalTemplate->paper_size)
            ->where('is_default', true)
            ->count();

        if ($thermalTemplate->is_default && $defaultCount === 1) {
            return response()->json(
                ['message' => 'Cannot delete the only default template for this paper size.'],
                422
            );
        }

        $thermalTemplate->delete();

        return response()->json(['message' => 'Thermal template deleted']);
    }

    /**
     * Seed built-in default templates (2inch + 3inch) for the company.
     * Skips any paper size that already has a default.
     */
    public function loadDefaults(Request $request): JsonResponse
    {
        $this->authorize('create', ThermalTemplate::class);

        $companyId = $request->user()->company_id;
        $userId = $request->user()->id;
        $created = [];

        $defaults = [
            '2inch' => [
                'name' => 'Default 2-inch (58mm)',
                'paper_width' => '58mm',
                'font_size' => '9px',
                'company_fs' => '11px',
            ],
            '3inch' => [
                'name' => 'Default 3-inch (80mm)',
                'paper_width' => '80mm',
                'font_size' => '10px',
                'company_fs' => '13px',
            ],
        ];

        foreach ($defaults as $paperSize => $cfg) {
            $alreadyExists = ThermalTemplate::where('company_id', $companyId)
                ->where('paper_size', $paperSize)
                ->where('is_default', true)
                ->exists();

            if ($alreadyExists) {
                continue;
            }

            $html = $this->buildDefaultHtml($cfg);

            ThermalTemplate::create([
                'company_id' => $companyId,
                'name' => $cfg['name'],
                'html_content' => $html,
                'paper_size' => $paperSize,
                'is_default' => true,
                'created_by' => $userId,
            ]);

            $created[] = $paperSize;
        }

        return response()->json([
            'data' => ['created' => $created],
            'message' => count($created)
                ? 'Default templates created: '.implode(', ', $created)
                : 'Default templates already exist for all paper sizes.',
        ]);
    }

    private function buildDefaultHtml(array $cfg): string
    {
        $w = $cfg['paper_width'];
        $fs = $cfg['font_size'];
        $cs = $cfg['company_fs'];

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tax Invoice - {{invoice_number}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: monospace;
            font-size: {$fs};
            color: #000;
            line-height: 1.3;
            width: {$w};
            background: #fff;
            margin: 0 auto;
        }
        .receipt { padding: 8px; }
        .header {
            text-align: center;
            margin-bottom: 6px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
        }
        .company-name { font-weight: bold; font-size: {$cs}; }
        .company-sub  { font-size: 7px; margin-top: 1px; }
        .invoice-title {
            text-align: center;
            font-weight: bold;
            margin: 5px 0 3px;
            border-bottom: 1px dashed #000;
            padding-bottom: 3px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: {$fs};
            margin: 1px 0;
        }
        .label { font-weight: bold; }
        .customer-block {
            border-bottom: 1px dashed #000;
            margin: 4px 0;
            padding-bottom: 3px;
            font-size: {$fs};
        }
        table { width: 100%; border-collapse: collapse; margin: 6px 0; }
        th {
            border-bottom: 1px dashed #000;
            font-size: {$fs};
            padding: 2px;
            text-align: left;
        }
        td {
            border-bottom: 1px dotted #ccc;
            font-size: {$fs};
            padding: 2px;
            vertical-align: top;
        }
        .item-name { font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals {
            margin: 4px 0;
            border-top: 1px dashed #000;
            border-bottom: 2px solid #000;
            padding: 3px 0;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            font-size: {$fs};
            margin: 2px 0;
        }
        .grand-total {
            border-top: 1px solid #000;
            padding-top: 3px;
            font-weight: bold;
            font-size: {$cs};
        }
        .balance-row {
            display: flex;
            justify-content: space-between;
            font-size: {$fs};
            margin-top: 4px;
            font-weight: bold;
            color: #c00;
        }
        .footer {
            margin-top: 8px;
            padding-top: 5px;
            border-top: 2px solid #000;
            text-align: center;
            font-size: 7px;
        }
        @media print {
            body { margin: 0; width: {$w}; }
            .receipt { padding: 4px; }
        }
        @media screen {
            body { margin: 10px auto; border: 1px solid #999; box-shadow: 0 0 5px rgba(0,0,0,.1); }
        }
    </style>
</head>
<body>
<div class="receipt">

    {{-- Header --}}
    <div class="header">
        <div class="company-name">{{company_name}}</div>
        <div class="company-sub">TAX INVOICE</div>
        {{#if company_gstin}}<div class="company-sub">GSTIN: {{company_gstin}}</div>{{/if}}
        {{#if company_phone}}<div class="company-sub">Ph: {{company_phone}}</div>{{/if}}
    </div>

    {{-- Invoice info --}}
    <div class="invoice-title">Invoice #{{invoice_number}}</div>
    <div class="info-row"><span class="label">Date:</span><span>{{invoice_date_formatted}}</span></div>

    {{-- Customer --}}
    {{#if customer_name}}
    <div class="customer-block">
        <div style="font-weight:bold;">{{customer_name}}</div>
        {{#if customer_gstin}}<div>GSTIN: {{customer_gstin}}</div>{{/if}}
        {{#if customer_phone}}<div>Ph: {{customer_phone}}</div>{{/if}}
    </div>
    {{/if}}

    {{-- Items --}}
    {{items_table}}

    {{-- Totals --}}
    <div class="totals">
        <div class="total-row"><span>Subtotal:</span><span>{{subtotal}}</span></div>
        {{gst_summary}}
        <div class="total-row"><span>Round Off:</span><span>{{round_off}}</span></div>
        <div class="total-row grand-total"><span>NET PAYABLE:</span><span>&#x20B9;{{grand_total}}</span></div>
    </div>

    {{-- Balance due --}}
    {{#if balance_due_raw}}
    <div class="balance-row"><span>Balance Due:</span><span>&#x20B9;{{balance_due}}</span></div>
    {{/if}}

    {{-- Footer --}}
    <div class="footer">
        <div>Thank you for your business!</div>
        <div style="margin-top:2px;">{{invoice_date_formatted}}</div>
    </div>

</div>
</body>
</html>
HTML;
    }

    /**
     * Set a template as default for its paper size.
     */
    public function setDefault(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        // Unset other defaults for this paper size
        ThermalTemplate::where('company_id', $thermalTemplate->company_id)
            ->where('paper_size', $thermalTemplate->paper_size)
            ->where('id', '!=', $thermalTemplate->id)
            ->update(['is_default' => false]);

        // Set this as default
        $thermalTemplate->update([
            'is_default' => true,
            'updated_by' => $request->user()->id,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }
}
