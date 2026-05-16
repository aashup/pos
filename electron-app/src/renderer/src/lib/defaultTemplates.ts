// Hardcoded fallback templates used when SQLite has no active template.
// These are embedded at build time and require no network or disk access.

import type { LocalPrintTemplate } from '../bridge/ipc'

// ── KOT (ESC/POS text template) ───────────────────────────────────────────────
//
// Directive syntax parsed by ThermalPrinter.printKotFromTemplate():
//   ##CENTER   align center   ##LEFT  align left
//   ##BOLD     bold on        ##/BOLD bold off
//   ##DIVIDER  full-width separator line
//   {{key}}    scalar token   {{#items}}...{{/items}} array block

const DEFAULT_KOT_LAYOUT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:monospace;font-size:13px;width:80mm;padding:8px}
  .center{text-align:center}.bold{font-weight:bold}
  .divider{border-top:1px dashed #000;margin:4px 0}
  .item{margin:3px 0}.note{font-size:11px;margin-left:8px}
  @media print{@page{margin:0;size:80mm auto}body{width:80mm}}
</style>
</head>
<body>
  <div class="center bold" style="font-size:18px">KOT</div>
  <div class="center">#{{kot_number}}</div>
  <div class="divider"></div>
  <div>{{order_type}}{{table_name}}</div>
  <div>{{time}}</div>
  <div class="divider"></div>
  {{#items}}
  <div class="item bold">{{quantity}}x  {{name}}</div>
  {{#notes}}<div class="note">&#8627; {{notes}}</div>{{/notes}}
  {{/items}}
  <div class="divider"></div>
  {{#notes}}<div style="font-size:11px">Note: {{notes}}</div>{{/notes}}
</body>
</html>`

// ── Invoice (HTML template) ───────────────────────────────────────────────────
//
// Self-contained HTML — no external CSS or font imports (offline-safe).
// Uses inline styles so @media print renders correctly without a stylesheet link.

const DEFAULT_INVOICE_LAYOUT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:monospace;font-size:12px;width:80mm;padding:8px}
  .center{text-align:center}
  .bold{font-weight:bold}
  .divider{border-top:1px dashed #000;margin:4px 0}
  table{width:100%;border-collapse:collapse}
  td{padding:1px 2px;vertical-align:top}
  .right{text-align:right}
  .header{font-size:14px;font-weight:bold}
  .total-row td{font-weight:bold;font-size:13px}
  .footer{text-align:center;margin-top:8px;font-size:11px}
  @media print{@page{margin:0;size:80mm auto}body{width:80mm}}
</style>
</head>
<body>
  <div class="center">
    <div class="header">{{outletName}}</div>
    <div>{{outletAddress}}</div>
    <div>{{outletPhone}}</div>
    <div>GSTIN: {{outletGstin}}</div>
  </div>
  <div class="divider"></div>
  <div>Invoice: <strong>{{invoiceNumber}}</strong></div>
  <div>Date: {{invoiceDate}}</div>
  <div>Type: {{orderType}}{{tableName}}</div>
  {{#customerName}}<div>Customer: {{customerName}}</div>{{/customerName}}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <td class="bold">Item</td>
        <td class="bold right">Qty</td>
        <td class="bold right">Amt</td>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{name}}</td>
        <td class="right">{{quantity}}</td>
        <td class="right">{{lineTotal}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
  <div class="divider"></div>
  <table>
    <tr><td>Discount</td><td class="right">-{{discount}}</td></tr>
    <tr><td>CGST</td><td class="right">{{cgst}}</td></tr>
    <tr><td>SGST</td><td class="right">{{sgst}}</td></tr>
    <tr class="total-row"><td>TOTAL</td><td class="right">Rs.{{grandTotal}}</td></tr>
  </table>
  <div class="divider"></div>
  <table>
    <tr><td>Payment</td><td class="right">{{paymentMode}}</td></tr>
    {{#amountTendered}}<tr><td>Tendered</td><td class="right">Rs.{{amountTendered}}</td></tr>{{/amountTendered}}
    {{#change}}<tr><td>Change</td><td class="right">Rs.{{change}}</td></tr>{{/change}}
  </table>
  <div class="footer">{{footerNote}}</div>
</body>
</html>`

export const DEFAULT_KOT_TEMPLATE: LocalPrintTemplate = {
  id: '__default_kot__',
  type: 'kot',
  name: 'Default KOT',
  layout: DEFAULT_KOT_LAYOUT,
  is_active: 1,
  server_id: null,
  sync_status: 'synced',
  updated_at: null,
  created_at: new Date().toISOString(),
}

export const DEFAULT_INVOICE_TEMPLATE: LocalPrintTemplate = {
  id: '__default_invoice__',
  type: 'invoice',
  name: 'Default Invoice',
  layout: DEFAULT_INVOICE_LAYOUT,
  is_active: 1,
  server_id: null,
  sync_status: 'synced',
  updated_at: null,
  created_at: new Date().toISOString(),
}
