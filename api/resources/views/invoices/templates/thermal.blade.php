<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tax Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: monospace;
            font-size: {{ $paperSize === '3inch' ? '10px' : '9px' }};
            color: #000;
            line-height: 1.2;
            width: {{ $paperSize === '3inch' ? '80mm' : '58mm' }};
            background: #fff;
            margin: 0 auto;
        }

        .receipt {
            padding: {{ $paperSize === '3inch' ? '8px' : '6px' }};
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: {{ $paperSize === '3inch' ? '3px' : '2px' }};
            text-align: left;
            font-size: {{ $paperSize === '3inch' ? '10px' : '9px' }};
        }

        th {
            border-bottom: 1px dashed #000;
            font-weight: bold;
            text-align: center;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
        }

        .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
        }

        .company-name {
            font-weight: bold;
            font-size: {{ $paperSize === '3inch' ? '12px' : '11px' }};
        }

        .invoice-title {
            font-weight: bold;
            margin: 6px 0 3px 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 3px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: {{ $paperSize === '3inch' ? '9px' : '8px' }};
            margin: 1px 0;
        }

        .label {
            font-weight: bold;
            flex-basis: 40%;
        }

        .value {
            flex-basis: 60%;
            text-align: right;
        }

        .items-table {
            width: 100%;
            margin: 6px 0;
        }

        .items-table th {
            border-bottom: 1px dashed #000;
            font-size: {{ $paperSize === '3inch' ? '9px' : '8px' }};
            padding: 2px;
        }

        .items-table td {
            border-bottom: 1px dotted #ccc;
            font-size: {{ $paperSize === '3inch' ? '9px' : '8px' }};
            padding: 2px;
        }

        .item-name {
            font-weight: bold;
        }

        .item-qty {
            text-align: center;
        }

        .item-rate {
            text-align: right;
        }

        .item-total {
            text-align: right;
            font-weight: bold;
        }

        .totals-section {
            margin: 6px 0;
            border-top: 1px dashed #000;
            border-bottom: 2px solid #000;
            padding: 3px 0;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            font-size: {{ $paperSize === '3inch' ? '10px' : '9px' }};
            margin: 2px 0;
            padding: 2px 0;
        }

        .total-label {
            font-weight: bold;
        }

        .total-value {
            text-align: right;
            font-weight: bold;
        }

        .grand-total-row {
            border-top: 1px solid #000;
            padding-top: 3px;
            font-size: {{ $paperSize === '3inch' ? '11px' : '10px' }};
            font-weight: bold;
        }

        .footer {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 2px solid #000;
            text-align: center;
            font-size: {{ $paperSize === '3inch' ? '8px' : '7px' }};
        }

        .footer-text {
            margin: 2px 0;
        }

        /* Print styles */
        @media print {
            body {
                margin: 0;
                padding: 0;
                width: {{ $paperSize === '3inch' ? '80mm' : '58mm' }};
            }
            .receipt {
                padding: {{ $paperSize === '3inch' ? '4px' : '3px' }};
            }
        }

        /* Screen preview styles */
        @media screen {
            body {
                margin: 10px auto;
                background: #f5f5f5;
                border: 1px solid #999;
                box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
            }
        }
    </style>
</head>
<body>
    <div class="receipt">
        {{-- Header --}}
        <div class="header">
            <div class="company-name">{{ $company->name ?? 'Company' }}</div>
            <div style="font-size: {{ $paperSize === '3inch' ? '8px' : '7px' }};">TAX INVOICE</div>
        </div>

        {{-- Invoice Details --}}
        <div class="invoice-title">Invoice #{{ $invoice->invoice_number }}</div>

        <div class="info-row">
            <span class="label">Date:</span>
            <span class="value">{{ \Carbon\Carbon::parse($invoice->invoice_date)->format('d/m/Y') }}</span>
        </div>

        {{-- Party/Customer Details --}}
        @if($invoice->party)
        <div style="border-bottom: 1px dashed #000; margin: 4px 0; padding-bottom: 3px;">
            <div style="font-weight: bold; font-size: {{ $paperSize === '3inch' ? '9px' : '8px' }};">
                {{ $invoice->party->name }}
            </div>
            @if($invoice->party->gstin)
            <div style="font-size: {{ $paperSize === '3inch' ? '8px' : '7px' }};">GSTIN: {{ $invoice->party->gstin }}</div>
            @endif
        </div>
        @endif

        {{-- Items --}}
        <table class="items-table">
            <thead>
                <tr>
                    <th style="text-align: left;">Item</th>
                    <th class="item-qty">Qty</th>
                    <th class="item-rate">Rate</th>
                    <th class="item-total">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($invoice->lines as $line)
                <tr>
                    <td class="item-name" colspan="4" style="border-bottom: none; padding-bottom: 1px;">
                        {{ $line->item->name }}
                        @if($line->item->hsn_code)
                        <span style="font-size: 7px;">(HSN: {{ $line->item->hsn_code }})</span>
                        @endif
                    </td>
                </tr>
                <tr>
                    <td style="text-align: right; font-size: 7px;">
                        {{ $line->quantity }}x{{ number_format($line->rate, 2) }}
                    </td>
                    <td class="item-qty">{{ round($line->quantity, 2) }}</td>
                    <td class="item-rate">{{ number_format($line->rate, 0) }}</td>
                    <td class="item-total">{{ number_format($line->line_total, 0) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        {{-- Totals Section --}}
        <div class="totals-section">
            <div class="total-row">
                <span class="total-label">Subtotal:</span>
                <span class="total-value">{{ number_format($invoice->total_amount, 0) }}</span>
            </div>

            @if($invoice->cgst_total > 0)
            <div class="total-row">
                <span class="total-label">CGST ({{ $invoice->lines[0]->gst_rate / 2 ?? 0 }}%):</span>
                <span class="total-value">{{ number_format($invoice->cgst_total, 0) }}</span>
            </div>
            @endif

            @if($invoice->sgst_total > 0)
            <div class="total-row">
                <span class="total-label">SGST ({{ $invoice->lines[0]->gst_rate / 2 ?? 0 }}%):</span>
                <span class="total-value">{{ number_format($invoice->sgst_total, 0) }}</span>
            </div>
            @endif

            @if($invoice->igst_total > 0)
            <div class="total-row">
                <span class="total-label">IGST ({{ $invoice->lines[0]->gst_rate ?? 0 }}%):</span>
                <span class="total-value">{{ number_format($invoice->igst_total, 0) }}</span>
            </div>
            @endif

            @php $roundOffFmt = $roundOff >= 0 ? '+'.number_format($roundOff, 2) : number_format($roundOff, 2); @endphp
            <div class="total-row">
                <span class="total-label">Round Off:</span>
                <span class="total-value" style="{{ $roundOff != 0 ? 'font-style:italic;' : 'color:#999;' }}">{{ $roundOffFmt }}</span>
            </div>

            <div class="total-row grand-total-row">
                <span>NET PAYABLE:</span>
                <span>₹{{ number_format($netPayable, 0) }}</span>
            </div>
        </div>

        {{-- Balance Due --}}
        @if($invoice->balance_due > 0)
        <div class="total-row" style="font-size: {{ $paperSize === '3inch' ? '9px' : '8px' }}; margin-top: 4px;">
            <span class="total-label">Balance Due:</span>
            <span class="total-value">₹{{ number_format($invoice->balance_due, 0) }}</span>
        </div>
        @endif

        {{-- Footer --}}
        <div class="footer">
            <div class="footer-text">Thank you!</div>
            <div class="footer-text" style="font-size: {{ $paperSize === '3inch' ? '7px' : '6px' }};">
                {{ \Carbon\Carbon::parse($invoice->invoice_date)->format('d/m/Y H:i') }}
            </div>
        </div>
    </div>

    <script>
        window.addEventListener('load', function() {
            // Auto-print can be enabled by uncommenting the line below
            // window.print();
        });
    </script>
</body>
</html>
