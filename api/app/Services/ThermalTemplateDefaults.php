<?php

namespace App\Services;

class ThermalTemplateDefaults
{
    public static function sizes(): array
    {
        return [
            '2inch' => ['paper_width' => '58mm', 'font_size' => '9px',  'company_fs' => '11px'],
            '3inch' => ['paper_width' => '80mm', 'font_size' => '10px', 'company_fs' => '13px'],
        ];
    }

    public static function buildKotHtml(array $cfg): string
    {
        $w = $cfg['paper_width'];

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: monospace; font-size: 13px; width: {$w}; padding: 8px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .item { margin: 3px 0; }
  .note { font-size: 11px; color: #444; margin-left: 8px; }
  .footer { text-align: center; margin-top: 8px; font-size: 11px; }
  @media print { @page { margin: 0; size: auto; } body { width: auto; } }
</style>
</head>
<body>
<div class="center bold" style="font-size:18px">KOT</div>
<div class="center">#{{kot_number}}</div>
<div class="divider"></div>
<div>Type: {{order_type}}{{table_name}}</div>
<div>Time: {{time}}</div>
<div class="divider"></div>
{{#items}}<div class="item bold">{{quantity}}x  {{name}}</div>
{{#notes}}<div class="note">&#x21b3; {{notes}}</div>{{/notes}}
{{/items}}
<div class="divider"></div>
{{#notes}}<div class="footer">Note: {{notes}}</div>{{/notes}}
</body>
</html>
HTML;
    }

    public static function buildInvoiceHtml(array $cfg): string
    {
        $w  = $cfg['paper_width'];
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

    <div class="header">
        <div class="company-name">{{company_name}}</div>
        <div class="company-sub">TAX INVOICE</div>
        {{#if company_gstin}}<div class="company-sub">GSTIN: {{company_gstin}}</div>{{/if}}
        {{#if company_phone}}<div class="company-sub">Ph: {{company_phone}}</div>{{/if}}
    </div>

    <div class="invoice-title">Invoice #{{invoice_number}}</div>
    <div class="info-row"><span class="label">Date:</span><span>{{invoice_date_formatted}}</span></div>

    {{#if customer_name}}
    <div class="customer-block">
        <div style="font-weight:bold;">{{customer_name}}</div>
        {{#if customer_gstin}}<div>GSTIN: {{customer_gstin}}</div>{{/if}}
        {{#if customer_phone}}<div>Ph: {{customer_phone}}</div>{{/if}}
    </div>
    {{/if}}

    {{items_table}}

    <div class="totals">
        <div class="total-row"><span>Subtotal:</span><span>{{subtotal}}</span></div>
        {{gst_summary}}
        <div class="total-row"><span>Round Off:</span><span>{{round_off}}</span></div>
        <div class="total-row grand-total"><span>NET PAYABLE:</span><span>&#x20B9;{{grand_total}}</span></div>
    </div>

    {{#if balance_due_raw}}
    <div class="balance-row"><span>Balance Due:</span><span>&#x20B9;{{balance_due}}</span></div>
    {{/if}}

    <div class="footer">
        <div>Thank you for your business!</div>
        <div style="margin-top:2px;">{{invoice_date_formatted}}</div>
    </div>

</div>
</body>
</html>
HTML;
    }
}
