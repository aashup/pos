<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\SalesInvoice;
use App\Models\ThermalTemplate;
use App\Services\InvoicePdfService;
use App\Services\ThermalTemplateRenderer;
use Carbon\Carbon;
use Illuminate\Http\Request;

class PublicInvoiceController extends Controller
{
    /**
     * Public invoice view — accessible without authentication via share_token.
     * Returns HTML with Open Graph meta tags so WhatsApp/social apps generate a preview.
     */
    public function show(Request $request, string $token)
    {
        $invoice = SalesInvoice::withoutGlobalScopes()
            ->where('share_token', $token)
            ->with(['lines.item', 'lines.batch', 'party', 'branch', 'godown', 'company'])
            ->first();

        if (! $invoice) {
            abort(404, 'Invoice not found.');
        }

        $company = $invoice->company ?? Company::find($invoice->company_id);
        // Use query param if provided; otherwise fall back to company's saved setting
        $paperSize = $request->query('paper_size')
            ?? CompanySetting::getValue($invoice->company_id, 'thermal_printer_paper_size', '2inch');
        $format = $request->query('format', 'html'); // html | pdf

        // Build invoice HTML body (reuse existing service)
        $service = app(InvoicePdfService::class);
        $renderer = app(ThermalTemplateRenderer::class);

        $customTemplate = ThermalTemplate::where('company_id', $invoice->company_id)
            ->where('paper_size', $paperSize)
            ->where('is_default', true)
            ->first();

        $invoiceHtml = $customTemplate
            ? $renderer->render($customTemplate, $invoice, $company)
            : $service->generateHtml($invoice, 'thermal', $paperSize);

        if ($format === 'pdf') {
            $pdf = $service->generate($invoice);

            return $pdf->download("Invoice-{$invoice->invoice_number}.pdf");
        }

        // Build share URL using the actual request host (not APP_URL which may be internal Docker hostname)
        $shareUrl = $request->getSchemeAndHttpHost()."/api/v1/public/invoices/{$token}";

        // Round-off for display
        $grandTotal = (float) $invoice->grand_total;
        $fraction = round($grandTotal - floor($grandTotal), 2);
        $netPayable = $fraction > 0.6 ? (int) ceil($grandTotal) : (int) floor($grandTotal);
        $roundOff = $netPayable - $grandTotal;

        $ogTitle = "Invoice #{$invoice->invoice_number}".($company ? " — {$company->name}" : '');
        $ogDescription = "Amount: ₹{$netPayable}".
            ($invoice->party ? " | {$invoice->party->name}" : '').
            ' | Date: '.Carbon::parse($invoice->invoice_date)->format('d M Y');

        $html = view('invoices.public', compact(
            'invoice', 'company', 'invoiceHtml', 'shareUrl',
            'netPayable', 'roundOff', 'ogTitle', 'ogDescription', 'token', 'paperSize'
        ))->render();

        if (! $invoice->is_printed) {
            $invoice->update(['is_printed' => true]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }
}
