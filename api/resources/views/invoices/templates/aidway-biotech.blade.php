<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>GST Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        @page {
            size: A4;
            margin: 6mm;
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
        .border { border: 1px solid #000; }
        .border-b { border-bottom: 1px solid #000; }
        .border-r { border-right: 1px solid #000; }
        .border-t { border-top: 1px solid #000; }
        .border-l { border-left: 1px solid #000; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .text-lg { font-size: 16px; }
        .text-md { font-size: 11px; }
        .text-sm { font-size: 8px; }
        .text-xs { font-size: 7px; }
        .nowrap { white-space: nowrap; }

        .outer-border {
            border: 2px solid #000;
        }

        /* Company header */
        .company-header {
            text-align: center;
            padding: 8px 10px 4px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .company-address {
            font-size: 9px;
            margin-top: 2px;
        }
        .company-phone {
            font-size: 9px;
            margin-top: 1px;
        }
        .company-email {
            font-size: 8px;
            margin-top: 1px;
        }

        /* GST Invoice banner */
        .gst-banner {
            background-color: #d0d0d0;
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            padding: 4px 0;
            letter-spacing: 2px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
        }

        /* Info rows */
        .info-row td {
            padding: 3px 6px;
            font-size: 9px;
            vertical-align: top;
        }

        /* Bill To section */
        .bill-to {
            padding: 4px 8px;
            font-size: 9px;
        }
        .bill-to-label {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 2px;
        }

        /* Items table */
        .items-table th {
            background-color: #c8e0f4;
            padding: 4px 3px;
            font-size: 8px;
            text-align: center;
            border: 1px solid #000;
            font-weight: bold;
        }
        .items-table td {
            padding: 2px 3px;
            border: 1px solid #999;
            font-size: 8px;
            vertical-align: middle;
        }
        .items-table tr:nth-child(even) td {
            background-color: #f5f9ff;
        }

        /* GST summary table */
        .gst-summary-table th {
            background-color: #c8e0f4;
            padding: 3px 4px;
            font-size: 8px;
            text-align: center;
            border: 1px solid #000;
            font-weight: bold;
        }
        .gst-summary-table td {
            padding: 2px 4px;
            border: 1px solid #999;
            font-size: 8px;
        }

        /* Totals on right */
        .right-summary td {
            padding: 2px 6px;
            font-size: 9px;
        }

        /* Bank details */
        .bank-details {
            padding: 4px 8px;
            font-size: 8px;
        }

        /* Terms */
        .terms {
            padding: 4px 8px;
            font-size: 8px;
        }

        /* Footer */
        .footer-row td {
            padding: 6px 8px;
            font-size: 8px;
        }

        /* Print styles for browser printing */
        @media print {
            @page {
                size: A4;
                margin: 6mm;
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
            .outer-border {
                background: #fff;
            }
        }
    </style>
</head>
<body>
    <table class="outer-border">
        {{-- ==================== COMPANY HEADER ==================== --}}
        <tr>
            <td colspan="2">
                <div class="company-header">
                    <div class="company-name">{{ strtoupper($company->name ?? '') }}</div>
                    <div class="company-address">{{ $company->address ?? '' }}</div>
                    <div class="company-address">{{ $company->city ?? '' }}{{ $company->state ? ', ' . strtoupper($company->state) : '' }}{{ $company->pincode ? ' - ' . $company->pincode : '' }}</div>
                    @if($company->phone)
                    <div class="company-phone">Phone : {{ $company->phone }}</div>
                    @endif
                    @if($company->email)
                    <div class="company-email">E-Mail : {{ $company->email }}</div>
                    @endif
                </div>
            </td>
        </tr>

        {{-- ==================== GST INVOICE BANNER ==================== --}}
        <tr>
            <td colspan="2" class="gst-banner">GST INVOICE</td>
        </tr>

        {{-- ==================== INVOICE INFO ROW ==================== --}}
        <tr>
            <td class="border-r border-b" style="width: 50%; padding: 0;">
                <table class="info-row" style="width: 100%;">
                    <tr>
                        <td class="font-bold" style="width: 35%;">GSTIN :</td>
                        <td>{{ $company->gstin ?? '' }}</td>
                    </tr>
                    <tr>
                        <td class="font-bold">Invoice No. :</td>
                        <td>{{ $invoice->invoice_number }}</td>
                    </tr>
                    <tr>
                        <td class="font-bold">Date :</td>
                        <td>{{ $invoice->invoice_date ? $invoice->invoice_date->format('d-m-Y') : '' }}</td>
                    </tr>
                </table>
            </td>
            <td class="border-b" style="width: 50%; padding: 0;">
                <table class="info-row" style="width: 100%;">
                    <tr>
                        <td class="font-bold" style="width: 35%;">L.R NO. :</td>
                        <td>&nbsp;</td>
                    </tr>
                    <tr>
                        <td class="font-bold">L.R DATE :</td>
                        <td>{{ $invoice->invoice_date ? $invoice->invoice_date->format('d-m-Y') : '' }}</td>
                    </tr>
                    <tr>
                        <td class="font-bold">DELIVERY :</td>
                        <td>&nbsp;</td>
                    </tr>
                </table>
            </td>
        </tr>

        {{-- ==================== BILL TO / DELIVER TO ==================== --}}
        <tr>
            <td class="border-r border-b" style="width: 50%; padding: 0;">
                <div class="bill-to">
                    <div class="bill-to-label">BILL TO :</div>
                    <div class="font-bold">M/s {{ $party->name ?? '' }}</div>
                    <div>{{ $party->address ?? '' }}</div>
                    <div>{{ $party->city ?? '' }}{{ $party->state ? ', ' . $party->state : '' }}{{ $party->pincode ? ' - ' . $party->pincode : '' }}</div>
                    @if($party->phone)
                    <div>PH.NO.: {{ $party->phone }}</div>
                    @endif
                    @if($party->gstin)
                    <div>GSTIN : {{ $party->gstin }}</div>
                    @endif
                </div>
            </td>
            <td class="border-b" style="width: 50%; padding: 0;">
                <div class="bill-to">
                    <div class="bill-to-label">DELIVERY TO :</div>
                    <div class="font-bold">M/s {{ $party->name ?? '' }}</div>
                    <div>{{ $party->address ?? '' }}</div>
                    <div>{{ $party->city ?? '' }}{{ $party->state ? ', ' . $party->state : '' }}{{ $party->pincode ? ' - ' . $party->pincode : '' }}</div>
                </div>
            </td>
        </tr>

        {{-- ==================== LINE ITEMS ==================== --}}
        <tr>
            <td colspan="2" style="padding: 0;">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 3%;">S.</th>
                            <th style="width: 4%;">Qty.</th>
                            <th style="width: 5%;">Pack</th>
                            <th style="width: 17%;">Product</th>
                            <th style="width: 7%;">Batch</th>
                            <th style="width: 5%;">Exp</th>
                            <th style="width: 7%;">HSN</th>
                            <th style="width: 6%;">MRP</th>
                            <th style="width: 6%;">Rate</th>
                            <th style="width: 4%;">DIS%</th>
                            @if($invoice->is_inter_state)
                                <th style="width: 5%;">IGST%</th>
                                <th style="width: 7%;">IGST</th>
                            @else
                                <th style="width: 5%;">CGST%</th>
                                <th style="width: 5%;">SGST%</th>
                            @endif
                            <th style="width: 8%;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($lines as $index => $line)
                        <tr>
                            <td class="text-center">{{ $index + 1 }}.</td>
                            <td class="text-center">{{ (int)$line->quantity }}</td>
                            <td class="text-center">{{ $line->item->unit ?? '' }}</td>
                            <td>{{ strtoupper($line->item->name ?? '—') }}</td>
                            <td class="text-center">{{ $line->batch->batch_number ?? '' }}</td>
                            <td class="text-center nowrap">
                                @if($line->batch && $line->batch->expiry_date)
                                    {{ \Carbon\Carbon::parse($line->batch->expiry_date)->format('m/y') }}
                                @endif
                            </td>
                            <td class="text-center">{{ $line->item->hsn_code ?? '' }}</td>
                            <td class="text-right">{{ number_format((float)($line->item->mrp ?? 0), 2) }}</td>
                            <td class="text-right">{{ number_format((float)$line->rate, 2) }}</td>
                            <td class="text-center">{{ number_format((float)$line->discount_percent, 1) }}</td>
                            @if($invoice->is_inter_state)
                                <td class="text-center">{{ number_format((float)$line->gst_rate, 1) }}</td>
                                <td class="text-right">{{ number_format((float)$line->igst, 2) }}</td>
                            @else
                                <td class="text-center">{{ number_format((float)$line->gst_rate / 2, 1) }}</td>
                                <td class="text-center">{{ number_format((float)$line->gst_rate / 2, 1) }}</td>
                            @endif
                            <td class="text-right font-bold">{{ number_format((float)$line->line_total, 2) }}</td>
                        </tr>
                        @endforeach

                        {{-- Fill empty rows to maintain consistent height --}}
                        @for($i = count($lines); $i < 15; $i++)
                        <tr>
                            <td>&nbsp;</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                        @endfor
                    </tbody>
                </table>
            </td>
        </tr>

        {{-- ==================== GST SUMMARY + TOTALS ==================== --}}
        <tr>
            <td class="border-r border-t" style="width: 50%; vertical-align: top; padding: 0;">
                {{-- GST class-wise breakdown --}}
                <table class="gst-summary-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>CLASS</th>
                            <th>TOTAL</th>
                            <th>DIS.</th>
                            @if($invoice->is_inter_state)
                                <th>IGST</th>
                            @else
                                <th>CGST</th>
                                <th>SGST</th>
                            @endif
                            <th>TOTAL GST</th>
                        </tr>
                    </thead>
                    <tbody>
                        @php
                            // Group lines by GST rate
                            $gstGroups = $lines->groupBy('gst_rate');
                            $gstRateLabels = [5 => 'GST 5%', 12 => 'GST 12%', 18 => 'GST 18%', 28 => 'GST 28%'];
                            $totalTaxableAll = 0;
                            $totalDiscAll = 0;
                            $totalGstAll = 0;
                        @endphp
                        @foreach([5, 12, 18, 28] as $rate)
                            @php
                                $group = $gstGroups->get($rate, collect([]));
                                $groupTaxable = $group->sum('taxable_amount');
                                $groupDisc = 0;
                                if ($invoice->is_inter_state) {
                                    $groupGst = $group->sum('igst');
                                } else {
                                    $groupGst = $group->sum('cgst') + $group->sum('sgst');
                                }
                                $totalTaxableAll += $groupTaxable;
                                $totalDiscAll += $groupDisc;
                                $totalGstAll += $groupGst;
                            @endphp
                            <tr>
                                <td class="font-bold">{{ $gstRateLabels[$rate] }}</td>
                                <td class="text-right">{{ number_format($groupTaxable, 2) }}</td>
                                <td class="text-right">{{ number_format($groupDisc, 2) }}</td>
                                @if($invoice->is_inter_state)
                                    <td class="text-right">{{ number_format($groupGst, 2) }}</td>
                                @else
                                    <td class="text-right">{{ number_format($group->sum('cgst'), 2) }}</td>
                                    <td class="text-right">{{ number_format($group->sum('sgst'), 2) }}</td>
                                @endif
                                <td class="text-right">{{ number_format($groupGst, 2) }}</td>
                            </tr>
                        @endforeach
                        <tr style="border-top: 2px solid #000;">
                            <td class="font-bold">TOTAL</td>
                            <td class="text-right font-bold">{{ number_format($totalTaxableAll, 2) }}</td>
                            <td class="text-right font-bold">{{ number_format($totalDiscAll, 2) }}</td>
                            @if($invoice->is_inter_state)
                                <td class="text-right font-bold">{{ number_format($totalGstAll, 2) }}</td>
                            @else
                                <td class="text-right font-bold">{{ number_format((float)$invoice->cgst_total, 2) }}</td>
                                <td class="text-right font-bold">{{ number_format((float)$invoice->sgst_total, 2) }}</td>
                            @endif
                            <td class="text-right font-bold">{{ number_format($totalGstAll, 2) }}</td>
                        </tr>
                    </tbody>
                </table>
            </td>
            <td class="border-t" style="width: 50%; vertical-align: top; padding: 4px 8px;">
                {{-- Right side totals --}}
                <table style="width: 100%;">
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">SUB TOTAL</td>
                        <td class="text-right font-bold" style="padding: 2px 4px; width: 90px;">{{ number_format((float)$invoice->taxable_amount, 2) }}</td>
                    </tr>
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">DIS.</td>
                        <td class="text-right" style="padding: 2px 4px;">{{ number_format((float)($invoice->discount_amount ?? 0), 2) }}</td>
                    </tr>
                    @if($invoice->is_inter_state)
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">IGST</td>
                        <td class="text-right" style="padding: 2px 4px;">{{ number_format((float)$invoice->igst_total, 2) }}</td>
                    </tr>
                    @else
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">CGST</td>
                        <td class="text-right" style="padding: 2px 4px;">{{ number_format((float)$invoice->cgst_total, 2) }}</td>
                    </tr>
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">SGST</td>
                        <td class="text-right" style="padding: 2px 4px;">{{ number_format((float)$invoice->sgst_total, 2) }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">CR/DR NOTE</td>
                        <td class="text-right" style="padding: 2px 4px;">0.00</td>
                    </tr>
                    @if($roundOff != 0)
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">ROUND OFF</td>
                        <td class="text-right" style="padding: 2px 4px;">{{ ($roundOff >= 0 ? '+' : '') . number_format($roundOff, 2) }}</td>
                    </tr>
                    @else
                    <tr>
                        <td class="font-bold text-right" style="padding: 2px 8px;">ROUND OFF</td>
                        <td class="text-right" style="padding: 2px 4px;">0.00</td>
                    </tr>
                    @endif
                    <tr style="border-top: 2px solid #000;">
                        <td class="font-bold text-right" style="padding: 4px 8px; font-size: 11px;">GRAND TOTAL</td>
                        <td class="text-right font-bold" style="padding: 4px 4px; font-size: 11px;">{{ number_format($netPayable, 2) }}</td>
                    </tr>
                </table>
            </td>
        </tr>

        {{-- ==================== AMOUNT IN WORDS ==================== --}}
        <tr>
            <td colspan="2" class="border-t" style="padding: 4px 8px;">
                <span class="font-bold">Rs. </span>{{ $amountInWords }} Only
            </td>
        </tr>

        {{-- ==================== BANK DETAILS ==================== --}}
        <tr>
            <td colspan="2" class="border-t" style="padding: 0;">
                <div class="bank-details">
                    <div class="font-bold" style="text-decoration: underline; margin-bottom: 2px;">BANK DETAIL :-</div>
                    @if($company->bank_name || $company->bank_account_number)
                    <div class="font-bold">
                        {{ $company->bank_name ?? 'BANK' }}
                        @if($company->bank_account_number), A/C NO.{{ $company->bank_account_number }}@endif
                        @if($company->bank_ifsc), IFSC CODE {{ $company->bank_ifsc }}@endif
                    </div>
                    @if($company->bank_branch)
                    <div>BRANCH-{{ strtoupper($company->bank_branch) }}</div>
                    @endif
                    @else
                    <div>Bank details not configured</div>
                    @endif
                </div>
            </td>
        </tr>

        {{-- ==================== TERMS & SIGNATORY ==================== --}}
        <tr>
            <td class="border-r border-t" style="width: 50%; vertical-align: top; padding: 0;">
                <div class="terms">
                    <div class="font-bold" style="text-decoration: underline; margin-bottom: 3px;">Terms & Conditions</div>
                    <div style="line-height: 1.6;">
                        Goods once sold will not be taken back or exchanged.<br>
                        Bills not paid due date will attract 24% interest.<br>
                        Prescribed Sales Tax declaration will be given.
                    </div>
                    <div style="margin-top: 10px; border-top: 1px dashed #999; padding-top: 6px;">
                        Certified that the particulars given above are true and correct
                    </div>
                </div>
            </td>
            <td class="border-t" style="width: 50%; vertical-align: top; padding: 8px; text-align: right;">
                <div style="margin-bottom: 6px;">For <strong>{{ strtoupper($company->name ?? '') }}</strong></div>
                <div style="margin-top: 40px;">
                    <table style="width: 100%;">
                        <tr>
                            <td class="text-center" style="padding-top: 4px; border-top: 1px solid #000; width: 45%;">
                                Checked By
                            </td>
                            <td style="width: 10%;">&nbsp;</td>
                            <td class="text-center" style="padding-top: 4px; border-top: 1px solid #000; width: 45%;">
                                Authorised signatory
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    {{-- Software attribution --}}
    <div class="text-center text-xs" style="margin-top: 4px; color: #888;">
        Our Software ERP
    </div>
</body>
</html>
