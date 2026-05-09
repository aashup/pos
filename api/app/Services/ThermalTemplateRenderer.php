<?php

namespace App\Services;

use App\Helpers\NumberToWords;
use App\Models\Company;
use App\Models\SalesInvoice;
use App\Models\ThermalTemplate;
use Carbon\Carbon;

class ThermalTemplateRenderer
{
    /**
     * Render a thermal template with invoice data.
     * Uses simple variable substitution instead of Blade for maximum user customization.
     */
    public function render(ThermalTemplate $template, SalesInvoice $invoice, Company $company): string
    {
        // Load relationships
        $invoice->loadMissing([
            'lines.item',
            'lines.batch',
            'lines.godown',
            'party',
            'branch',
            'godown',
        ]);

        // Calculate round-off
        $grandTotal = (float) $invoice->grand_total;
        $roundedTotal = round($grandTotal);
        $roundOff = $roundedTotal - $grandTotal;

        // Prepare variables
        $variables = [
            '{{company_name}}' => $company->name ?? '',
            '{{company_gstin}}' => $company->gstin ?? '',
            '{{company_address}}' => $company->address ?? '',
            '{{company_phone}}' => $company->phone ?? '',
            '{{company_email}}' => $company->email ?? '',
            '{{invoice_number}}' => $invoice->invoice_number,
            '{{invoice_date}}' => $invoice->invoice_date,
            '{{invoice_date_formatted}}' => Carbon::parse($invoice->invoice_date)->format('d/m/Y'),
            '{{customer_name}}' => $invoice->party->name ?? '',
            '{{customer_gstin}}' => $invoice->party->gstin ?? '',
            '{{customer_address}}' => $invoice->party->address ?? '',
            '{{customer_city}}' => $invoice->party->city ?? '',
            '{{customer_phone}}' => $invoice->party->phone ?? '',
            '{{subtotal}}' => number_format($invoice->total_amount, 2),
            '{{subtotal_raw}}' => $invoice->total_amount,
            '{{cgst_total}}' => number_format($invoice->cgst_total, 2),
            '{{cgst_total_raw}}' => $invoice->cgst_total,
            '{{sgst_total}}' => number_format($invoice->sgst_total, 2),
            '{{sgst_total_raw}}' => $invoice->sgst_total,
            '{{igst_total}}' => number_format($invoice->igst_total, 2),
            '{{igst_total_raw}}' => $invoice->igst_total,
            '{{round_off}}' => number_format($roundOff, 2),
            '{{round_off_raw}}' => $roundOff,
            '{{grand_total}}' => number_format($roundedTotal, 2),
            '{{grand_total_raw}}' => $roundedTotal,
            '{{balance_due}}' => number_format($invoice->balance_due, 2),
            '{{balance_due_raw}}' => $invoice->balance_due,
            '{{amount_in_words}}' => NumberToWords::convert($roundedTotal),
        ];

        // Build items table HTML
        $itemsTableHtml = $this->buildItemsTable($invoice);
        $variables['{{items_table}}'] = $itemsTableHtml;
        $variables['{{items_list}}'] = $itemsTableHtml; // Alias

        // Build GST summary HTML
        $gstSummary = $this->buildGstSummary($invoice);
        $variables['{{gst_summary}}'] = $gstSummary;

        // Build truthy map for {{#if variable}} conditionals
        $truthyMap = [
            'company_name' => ! empty($company->name),
            'company_gstin' => ! empty($company->gstin),
            'company_address' => ! empty($company->address),
            'company_phone' => ! empty($company->phone),
            'company_email' => ! empty($company->email),
            'customer_name' => ! empty($invoice->party->name ?? null),
            'customer_gstin' => ! empty($invoice->party->gstin ?? null),
            'customer_address' => ! empty($invoice->party->address ?? null),
            'customer_city' => ! empty($invoice->party->city ?? null),
            'customer_phone' => ! empty($invoice->party->phone ?? null),
            'cgst_total' => (float) $invoice->cgst_total > 0,
            'sgst_total' => (float) $invoice->sgst_total > 0,
            'igst_total' => (float) $invoice->igst_total > 0,
            'round_off' => $roundOff !== 0.0,
            'round_off_raw' => $roundOff !== 0.0,
            'balance_due' => (float) $invoice->balance_due > 0,
            'balance_due_raw' => (float) $invoice->balance_due > 0,
        ];

        // Step 1: strip {{-- comments --}} and resolve {{#if}}...{{/if}} blocks
        $html = $this->processConditionals($template->html_content, $truthyMap);

        // Step 2: replace all {{variable}} tokens
        foreach ($variables as $placeholder => $value) {
            $html = str_replace($placeholder, $value, $html);
        }

        return $html;
    }

    /**
     * Strip {{-- comments --}} and evaluate {{#if variable}}...{{/if}} blocks.
     * Loops until stable so nested ifs resolve inside-out.
     */
    private function processConditionals(string $html, array $truthyMap): string
    {
        // Strip {{-- Blade-style comments --}}
        $html = preg_replace('/\{\{--.*?--\}\}/s', '', $html);

        // Resolve {{#if var}}...{{/if}} blocks, innermost first, until none remain
        $pattern = '/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/s';
        $prev = null;
        while ($prev !== $html) {
            $prev = $html;
            $html = preg_replace_callback($pattern, function (array $matches) use ($truthyMap): string {
                $variable = $matches[1];
                $content = $matches[2];

                return ($truthyMap[$variable] ?? false) ? $content : '';
            }, $html);
        }

        return $html;
    }

    /**
     * Build HTML table for invoice items.
     */
    private function buildItemsTable(SalesInvoice $invoice): string
    {
        $html = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                    <thead>
                        <tr style="border-bottom: 1px dashed #000;">
                            <th style="text-align: left; padding: 2px; font-size: 9px;">Item</th>
                            <th style="text-align: center; padding: 2px; font-size: 9px;">Qty</th>
                            <th style="text-align: right; padding: 2px; font-size: 9px;">Rate</th>
                            <th style="text-align: right; padding: 2px; font-size: 9px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>';

        foreach ($invoice->lines as $line) {
            $html .= '<tr style="border-bottom: 1px dotted #ccc;">
                        <td style="text-align: left; padding: 2px; font-size: 9px; font-weight: bold;">
                            '.htmlspecialchars($line->item->name).'
                        </td>
                        <td style="text-align: center; padding: 2px; font-size: 9px;">
                            '.round($line->quantity, 2).'
                        </td>
                        <td style="text-align: right; padding: 2px; font-size: 9px;">
                            '.number_format($line->rate, 0).'
                        </td>
                        <td style="text-align: right; padding: 2px; font-size: 9px;">
                            '.number_format($line->line_total, 0).'
                        </td>
                      </tr>';
        }

        $html .= '</tbody></table>';

        return $html;
    }

    /**
     * Build HTML for GST summary.
     */
    private function buildGstSummary(SalesInvoice $invoice): string
    {
        $html = '<div style="margin: 10px 0; border-top: 1px dashed #000; padding-top: 5px;">';

        if ($invoice->cgst_total > 0) {
            $html .= '<div style="display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0;">
                        <span>CGST:</span>
                        <span>'.number_format($invoice->cgst_total, 0).'</span>
                      </div>';
        }

        if ($invoice->sgst_total > 0) {
            $html .= '<div style="display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0;">
                        <span>SGST:</span>
                        <span>'.number_format($invoice->sgst_total, 0).'</span>
                      </div>';
        }

        if ($invoice->igst_total > 0) {
            $html .= '<div style="display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0;">
                        <span>IGST:</span>
                        <span>'.number_format($invoice->igst_total, 0).'</span>
                      </div>';
        }

        $html .= '</div>';

        return $html;
    }
}
