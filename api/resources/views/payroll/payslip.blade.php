<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payslip - {{ $employee->name }} - {{ $period }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            background: #fff;
        }

        .page {
            padding: 24px;
            max-width: 740px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            border-bottom: 2px solid #1e3a5f;
            padding-bottom: 12px;
        }

        .company-name {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a5f;
        }

        .company-details {
            font-size: 10px;
            color: #555;
            margin-top: 4px;
            line-height: 1.5;
        }

        .payslip-title {
            text-align: right;
        }

        .payslip-title h2 {
            font-size: 14px;
            font-weight: bold;
            color: #1e3a5f;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .payslip-title .period {
            font-size: 11px;
            color: #555;
            margin-top: 4px;
        }

        .employee-block {
            background: #f4f7fb;
            border: 1px solid #d0dff0;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 14px;
        }

        .employee-block table {
            width: 100%;
            border-collapse: collapse;
        }

        .employee-block td {
            padding: 3px 8px 3px 0;
            font-size: 10.5px;
            vertical-align: top;
        }

        .employee-block td.label {
            color: #666;
            width: 28%;
        }

        .employee-block td.value {
            font-weight: 600;
            color: #222;
        }

        .salary-tables {
            display: flex;
            gap: 12px;
            margin-bottom: 14px;
        }

        .salary-section {
            flex: 1;
        }

        .salary-section h4 {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #fff;
            background: #1e3a5f;
            padding: 5px 8px;
            border-radius: 3px 3px 0 0;
        }

        .salary-section table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d0dff0;
            border-top: none;
        }

        .salary-section table tr:nth-child(even) {
            background: #f8fafd;
        }

        .salary-section td {
            padding: 4px 8px;
            font-size: 10.5px;
            border-bottom: 1px solid #edf2f7;
        }

        .salary-section td.amount {
            text-align: right;
            font-weight: 600;
        }

        .salary-section tfoot td {
            font-weight: bold;
            background: #edf2f7;
            border-top: 1px solid #b0c4d8;
        }

        .net-row {
            background: #1e3a5f;
            color: #fff;
            border-radius: 4px;
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
        }

        .net-row .label {
            font-size: 12px;
            font-weight: bold;
        }

        .net-row .amount {
            font-size: 16px;
            font-weight: bold;
        }

        .net-row .words {
            font-size: 10px;
            opacity: 0.85;
            margin-top: 2px;
        }

        .attendance-row {
            border: 1px solid #d0dff0;
            border-radius: 4px;
            padding: 8px 16px;
            margin-bottom: 14px;
            font-size: 10.5px;
            display: flex;
            gap: 24px;
        }

        .attendance-row .item {
            display: flex;
            flex-direction: column;
        }

        .attendance-row .item .lbl {
            color: #666;
            font-size: 10px;
            text-transform: uppercase;
        }

        .attendance-row .item .val {
            font-weight: bold;
            font-size: 13px;
            margin-top: 2px;
        }

        .employer-row {
            font-size: 10px;
            color: #666;
            border-top: 1px dashed #ccc;
            padding-top: 8px;
        }

        .employer-row table {
            width: 100%;
            border-collapse: collapse;
        }

        .employer-row td {
            padding: 3px 8px 3px 0;
        }

        .employer-row td.amount {
            text-align: right;
            font-weight: 600;
            color: #333;
        }

        .footer {
            margin-top: 16px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            font-size: 9px;
            color: #999;
            text-align: center;
        }

        .generated {
            font-size: 9px;
            color: #aaa;
            text-align: right;
            margin-bottom: 4px;
        }
    </style>
</head>

<body>
    <div class="page">

        {{-- Header --}}
        <div class="header">
            <div>
                <div class="company-name">{{ $company->name }}</div>
                <div class="company-details">
                    {{ $company->address ?? '' }}@if ($company->city)
                        , {{ $company->city }}
                    @endif
                    @if ($company->state)
                        , {{ $company->state }}
                    @endif
                    <br>
                    @if ($company->gstin)
                        GSTIN: {{ $company->gstin }}
                    @endif
                    @if ($company->phone)
                        | Phone: {{ $company->phone }}
                    @endif
                </div>
            </div>
            <div class="payslip-title">
                <h2>Pay Slip</h2>
                <div class="period">{{ $period }}</div>
            </div>
        </div>

        {{-- Employee Info --}}
        <div class="employee-block">
            <table>
                <tr>
                    <td class="label">Employee Name</td>
                    <td class="value">{{ $employee->name }}</td>
                    <td class="label">Employee Code</td>
                    <td class="value">{{ $employee->employee_code ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Designation</td>
                    <td class="value">{{ $employee->designation?->name ?? '—' }}</td>
                    <td class="label">Department</td>
                    <td class="value">{{ $employee->department?->name ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Date of Joining</td>
                    <td class="value">{{ $employee->joining_date ? $employee->joining_date->format('d M Y') : '—' }}
                    </td>
                    <td class="label">PAN</td>
                    <td class="value">{{ $employee->pan ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">PF Number</td>
                    <td class="value">{{ $employee->pf_number ?? '—' }}</td>
                    <td class="label">ESI Number</td>
                    <td class="value">{{ $employee->esi_number ?? '—' }}</td>
                </tr>
            </table>
        </div>

        {{-- Attendance --}}
        <div class="attendance-row">
            <div class="item">
                <span class="lbl">Working Days</span>
                <span class="val">{{ $run->working_days }}</span>
            </div>
            <div class="item">
                <span class="lbl">Present Days</span>
                <span class="val">{{ $entry->present_days }}</span>
            </div>
            <div class="item">
                <span class="lbl">Absent Days</span>
                <span class="val">{{ $run->working_days - $entry->present_days }}</span>
            </div>
        </div>

        {{-- Earnings & Deductions --}}
        <div class="salary-tables">
            <div class="salary-section">
                <h4>Earnings</h4>
                <table>
                    <tbody>
                        <tr>
                            <td>Basic Salary</td>
                            <td class="amount">Rs.{{ number_format($entry->basic, 2) }}</td>
                        </tr>
                        @if ((float) $entry->hra > 0)
                            <tr>
                                <td>HRA</td>
                                <td class="amount">Rs.{{ number_format($entry->hra, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->da > 0)
                            <tr>
                                <td>Dearness Allowance</td>
                                <td class="amount">Rs.{{ number_format($entry->da, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->conveyance > 0)
                            <tr>
                                <td>Conveyance</td>
                                <td class="amount">Rs.{{ number_format($entry->conveyance, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->medical > 0)
                            <tr>
                                <td>Medical Allowance</td>
                                <td class="amount">Rs.{{ number_format($entry->medical, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->special_allowance > 0)
                            <tr>
                                <td>Special Allowance</td>
                                <td class="amount">Rs.{{ number_format($entry->special_allowance, 2) }}</td>
                            </tr>
                        @endif
                        @foreach ($entry->custom_components ?? [] as $comp)
                            @if (($comp['type'] ?? '') === 'earning' && (float) ($comp['amount'] ?? 0) > 0)
                                <tr>
                                    <td>{{ $comp['name'] }}</td>
                                    <td class="amount">Rs.{{ number_format((float) $comp['amount'], 2) }}</td>
                                </tr>
                            @endif
                        @endforeach
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Gross Salary</strong></td>
                            <td class="amount"><strong>Rs.{{ number_format($entry->gross_salary, 2) }}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="salary-section">
                <h4>Deductions</h4>
                <table>
                    <tbody>
                        @if ((float) $entry->pf_employee > 0)
                            <tr>
                                <td>PF (Employee 12%)</td>
                                <td class="amount">Rs.{{ number_format($entry->pf_employee, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->esi_employee > 0)
                            <tr>
                                <td>ESI (Employee 0.75%)</td>
                                <td class="amount">Rs.{{ number_format($entry->esi_employee, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->professional_tax > 0)
                            <tr>
                                <td>Professional Tax</td>
                                <td class="amount">Rs.{{ number_format($entry->professional_tax, 2) }}</td>
                            </tr>
                        @endif
                        @if ((float) $entry->tds > 0)
                            <tr>
                                <td>TDS</td>
                                <td class="amount">Rs.{{ number_format($entry->tds, 2) }}</td>
                            </tr>
                        @endif
                        @foreach ($entry->custom_components ?? [] as $comp)
                            @if (($comp['type'] ?? '') === 'deduction' && (float) ($comp['amount'] ?? 0) > 0)
                                <tr>
                                    <td>{{ $comp['name'] }}</td>
                                    <td class="amount">Rs.{{ number_format((float) $comp['amount'], 2) }}</td>
                                </tr>
                            @endif
                        @endforeach
                        @if ((float) $entry->total_deductions == 0)
                            <tr>
                                <td colspan="2" style="color:#999; text-align:center; padding:8px;">No deductions
                                </td>
                            </tr>
                        @endif
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Total Deductions</strong></td>
                            <td class="amount"><strong>Rs.{{ number_format($entry->total_deductions, 2) }}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {{-- Net Salary --}}
        <div class="net-row">
            <div>
                <div class="label">Net Salary (Take Home)</div>
            </div>
            <div style="text-align: right;">
                <div class="amount">Rs.{{ number_format($entry->net_salary, 2) }}</div>
            </div>
        </div>

        {{-- Employer Contributions --}}
        @if ((float) $entry->pf_employer > 0 || (float) $entry->esi_employer > 0)
            <div class="employer-row">
                <strong>Employer Contributions (not deducted from salary)</strong>
                <table style="margin-top: 4px;">
                    @if ((float) $entry->pf_employer > 0)
                        <tr>
                            <td>PF Employer (13%)</td>
                            <td class="amount">Rs.{{ number_format($entry->pf_employer, 2) }}</td>
                        </tr>
                    @endif
                    @if ((float) $entry->esi_employer > 0)
                        <tr>
                            <td>ESI Employer (3.25%)</td>
                            <td class="amount">Rs.{{ number_format($entry->esi_employer, 2) }}</td>
                        </tr>
                    @endif
                </table>
            </div>
        @endif

        {{-- Footer --}}
        <div class="footer">
            This is a computer-generated payslip and does not require a signature.
        </div>

    </div>
</body>

</html>
