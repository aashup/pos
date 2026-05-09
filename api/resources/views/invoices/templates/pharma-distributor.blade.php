<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tax Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        @page {
            size: A4;
            margin: 8mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9px;
            color: #111;
            line-height: 1.3;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        .border { border: 1px solid #333; }
        .border-b { border-bottom: 1px solid #333; }
        .border-r { border-right: 1px solid #333; }
        .border-t { border-top: 1px solid #333; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .text-lg { font-size: 14px; }
        .text-md { font-size: 11px; }
        .text-sm { font-size: 8px; }
        .text-xs { font-size: 7px; }
        .p-2 { padding: 3px; }
        .p-4 { padding: 6px; }
        .nowrap { white-space: nowrap; }

        .header-table td {
            vertical-align: top;
            padding: 5px 8px;
        }
        .items-table th {
            background-color: #f0f0f0;
            padding: 4px 3px;
            font-size: 8px;
            text-align: center;
            border: 1px solid #333;
        }
        .items-table td {
            padding: 3px 2px;
            border: 1px solid #ccc;
            font-size: 8px;
            vertical-align: top;
        }
        .items-table tr:last-child td {
            border-bottom: 1px solid #333;
        }
        .totals-table td {
            padding: 2px 6px;
            font-size: 9px;
        }
        .summary-label {
            text-align: right;
            font-weight: bold;
            padding-right: 10px;
        }
        .summary-value {
            text-align: right;
            width: 100px;
        }

        /* Print styles for browser printing */
        @media print {
            @page {
                size: A4;
                margin: 8mm;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }

        /* Screen styles — center content when viewed in browser */
        @media screen {
            body {
                max-width: 210mm;
                margin: 10px auto;
                background: #f5f5f5;
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    {{-- ==================== HEADER ==================== --}}
    <table class="border">
        {{-- Row 1: Company | TAX INVOICE | Buyer --}}
        <tr>
            <td class="border-r border-b" style="width: 38%; vertical-align: top; padding: 6px 8px;">
                <div class="font-bold text-md">{{ $company->name ?? '' }}</div>
                <div>{{ $company->address ?? '' }}</div>
                <div>{{ $company->city ?? '' }}{{ $company->state ? ', ' . $company->state : '' }}{{ $company->pincode ? ' - ' . $company->pincode : '' }}</div>
                @if($company->phone)<div>Phone: {{ $company->phone }}</div>@endif
                @if($company->email)<div>Email: {{ $company->email }}</div>@endif
            </td>
            <td class="border-r border-b text-center" style="width: 24%; vertical-align: top; padding: 6px 8px;">
                <div class="font-bold text-lg" style="margin-bottom: 6px;">TAX INVOICE</div>
                <table style="width: 100%; font-size: 8px;">
                    <tr>
                        <td class="text-left font-bold">Inv No:</td>
                        <td class="text-left">{{ $invoice->invoice_number }}</td>
                    </tr>
                    <tr>
                        <td class="text-left font-bold">Date:</td>
                        <td class="text-left">{{ $invoice->invoice_date ? $invoice->invoice_date->format('d/m/Y') : '' }}</td>
                    </tr>
                    @if($invoice->due_date)
                    <tr>
                        <td class="text-left font-bold">Due Date:</td>
                        <td class="text-left">{{ $invoice->due_date->format('d/m/Y') }}</td>
                    </tr>
                    @endif
                </table>
            </td>
            <td class="border-b" style="width: 38%; vertical-align: top; padding: 6px 8px;">
                <div class="font-bold text-md">{{ $party->name ?? '' }}</div>
                <div>{{ $party->address ?? '' }}</div>
                <div>{{ $party->city ?? '' }}{{ $party->state ? ', ' . $party->state : '' }}{{ $party->pincode ? ' - ' . $party->pincode : '' }}</div>
                @if($party->contact_person)<div>Contact: {{ $party->contact_person }}</div>@endif
                @if($party->phone)<div>Phone: {{ $party->phone }}</div>@endif
            </td>
        </tr>

        {{-- Row 2: PAN/GSTIN Seller | PAN/GSTIN Buyer --}}
        <tr>
            <td class="border-r border-b" style="padding: 4px 8px;" colspan="1">
                @if($company->pan)<div>PAN: {{ $company->pan }}</div>@endif
                @if($company->gstin)<div>GSTIN: {{ $company->gstin }}</div>@endif
            </td>
            <td class="border-r border-b" style="padding: 4px 8px;">
                &nbsp;
            </td>
            <td class="border-b" style="padding: 4px 8px;">
                @if($party->pan)<div>PAN: {{ $party->pan }}</div>@endif
                @if($party->gstin)<div>GSTIN: {{ $party->gstin }}</div>@endif
            </td>
        </tr>
    </table>

    {{-- ==================== LINE ITEMS ==================== --}}
    <table class="items-table border" style="margin-top: -1px;">
        <thead>
            <tr>
                <th style="width: 3%;">S.No</th>
                <th style="width: 18%;">Product</th>
                <th style="width: 5%;">UOM</th>
                <th style="width: 7%;">HSN</th>
                <th style="width: 7%;">Batch</th>
                <th style="width: 5%;">Expiry</th>
                <th style="width: 6%;">Rate</th>
                <th style="width: 4%;">Qty</th>
                <th style="width: 4%;">Disc%</th>
                <th style="width: 8%;">Taxable</th>
                @if($invoice->is_inter_state)
                    <th style="width: 4%;">IGST%</th>
                    <th style="width: 7%;">IGST Amt</th>
                @else
                    <th style="width: 4%;">CGST%</th>
                    <th style="width: 7%;">CGST</th>
                    <th style="width: 4%;">SGST%</th>
                    <th style="width: 7%;">SGST</th>
                @endif
                <th style="width: 8%;">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($lines as $index => $line)
            <tr>
                <td class="text-center">{{ $index + 1 }}</td>
                <td>{{ $line->item->name ?? '—' }}</td>
                <td class="text-center">{{ $line->item->unit ?? '' }}</td>
                <td class="text-center">{{ $line->item->hsn_code ?? '' }}</td>
                <td class="text-center">{{ $line->batch->batch_number ?? '' }}</td>
                <td class="text-center nowrap">
                    @if($line->batch && $line->batch->expiry_date)
                        {{ \Carbon\Carbon::parse($line->batch->expiry_date)->format('M y') }}
                    @endif
                </td>
                <td class="text-right">{{ number_format((float)$line->rate, 2) }}</td>
                <td class="text-center">{{ (int)$line->quantity }}</td>
                <td class="text-center">{{ number_format((float)$line->discount_percent, 1) }}</td>
                <td class="text-right">{{ number_format((float)$line->taxable_amount, 2) }}</td>
                @if($invoice->is_inter_state)
                    <td class="text-center">{{ number_format((float)$line->gst_rate, 1) }}</td>
                    <td class="text-right">{{ number_format((float)$line->igst, 2) }}</td>
                @else
                    <td class="text-center">{{ number_format((float)$line->gst_rate / 2, 1) }}</td>
                    <td class="text-right">{{ number_format((float)$line->cgst, 2) }}</td>
                    <td class="text-center">{{ number_format((float)$line->gst_rate / 2, 1) }}</td>
                    <td class="text-right">{{ number_format((float)$line->sgst, 2) }}</td>
                @endif
                <td class="text-right font-bold">{{ number_format((float)$line->line_total, 2) }}</td>
            </tr>
            @endforeach

            {{-- Totals row --}}
            <tr style="border-top: 2px solid #333;">
                <td class="text-center font-bold" colspan="2">Total</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td class="text-center font-bold">{{ (int)$lines->sum('quantity') }}</td>
                <td></td>
                <td class="text-right font-bold">{{ number_format((float)$invoice->taxable_amount, 2) }}</td>
                @if($invoice->is_inter_state)
                    <td></td>
                    <td class="text-right font-bold">{{ number_format((float)$invoice->igst_total, 2) }}</td>
                @else
                    <td></td>
                    <td class="text-right font-bold">{{ number_format((float)$invoice->cgst_total, 2) }}</td>
                    <td></td>
                    <td class="text-right font-bold">{{ number_format((float)$invoice->sgst_total, 2) }}</td>
                @endif
                <td class="text-right font-bold">{{ number_format((float)$invoice->grand_total, 2) }}</td>
            </tr>
        </tbody>
    </table>

    {{-- ==================== SUMMARY ==================== --}}
    <table class="border" style="margin-top: -1px;">
        <tr>
            {{-- Amount in Words (left side) --}}
            <td style="width: 55%; vertical-align: top; padding: 8px;">
                <div class="font-bold" style="font-size: 9px; margin-bottom: 4px;">Amount in Words:</div>
                <div style="font-size: 9px;">{{ $amountInWords }}</div>
            </td>
            {{-- Totals breakdown (right side) --}}
            <td style="width: 45%; vertical-align: top; padding: 4px 8px;">
                <table style="width: 100%;">
                    <tr>
                        <td class="summary-label">Total Taxable Value</td>
                        <td class="summary-value">{{ number_format((float)$invoice->taxable_amount, 2) }}</td>
                    </tr>
                    @if((float)$invoice->discount_amount > 0)
                    <tr>
                        <td class="summary-label">Total Discount</td>
                        <td class="summary-value">{{ number_format((float)$invoice->discount_amount, 2) }}</td>
                    </tr>
                    @endif
                    @if($invoice->is_inter_state)
                    <tr>
                        <td class="summary-label">IGST</td>
                        <td class="summary-value">{{ number_format((float)$invoice->igst_total, 2) }}</td>
                    </tr>
                    @else
                    <tr>
                        <td class="summary-label">CGST</td>
                        <td class="summary-value">{{ number_format((float)$invoice->cgst_total, 2) }}</td>
                    </tr>
                    <tr>
                        <td class="summary-label">SGST</td>
                        <td class="summary-value">{{ number_format((float)$invoice->sgst_total, 2) }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td class="summary-label">Total Amount</td>
                        <td class="summary-value">{{ number_format((float)$invoice->grand_total, 2) }}</td>
                    </tr>
                    @if($roundOff != 0)
                    <tr>
                        <td class="summary-label">Round Off</td>
                        <td class="summary-value">{{ ($roundOff >= 0 ? '+' : '') . number_format($roundOff, 2) }}</td>
                    </tr>
                    @endif
                    <tr style="border-top: 1px solid #333;">
                        <td class="summary-label" style="font-size: 11px; padding-top: 4px;">Net Payable Amount</td>
                        <td class="summary-value font-bold" style="font-size: 11px; padding-top: 4px;">&#8377; {{ number_format($netPayable, 2) }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    {{-- ==================== FOOTER ==================== --}}
    <table class="border" style="margin-top: -1px;">
        <tr>
            <td style="width: 60%; vertical-align: top; padding: 8px;">
                <div class="font-bold" style="margin-bottom: 4px;">Terms & Conditions:</div>
                <div class="text-sm" style="line-height: 1.5;">
                    1. All disputes are subject to {{ $company->city ?? 'local' }} jurisdiction.<br>
                    2. Interest @ 18% PA will be charged on overdue payments.<br>
                    3. Goods once sold will not be taken back.<br>
                    4. E. & O.E.
                </div>
            </td>
            <td style="width: 40%; vertical-align: bottom; padding: 8px; text-align: right;">
                <div style="margin-bottom: 40px;">For <strong>{{ $company->name ?? '' }}</strong></div>
                <div style="border-top: 1px solid #333; display: inline-block; padding-top: 4px;">
                    Authorised Signatory
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
