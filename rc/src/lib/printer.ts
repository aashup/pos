import {PermissionsAndroid, Platform} from 'react-native';
import {
  BLEPrinter,
  NetPrinter,
  USBPrinter,
  COMMANDS,
  IBLEPrinter,
  IUSBPrinter,
} from 'react-native-thermal-receipt-printer-image-qr';
import RNPrint from 'react-native-print';
import {Q} from '@nozbe/watermelondb';

import {
  kotsCollection,
  orderLinesCollection,
  ordersCollection,
} from '@/src/db';
import Order from '@/src/db/models/Order';
import OrderLine from '@/src/db/models/OrderLine';
import Kot from '@/src/db/models/Kot';
import {usePrinterStore} from '@/src/store/printerStore';

// ── ESC/POS helpers ───────────────────────────────────────────────────────────

const TF = COMMANDS.TEXT_FORMAT;
const HL = COMMANDS.HORIZONTAL_LINE;
const LF = COMMANDS.LF;

/** Column widths: 58mm→32 chars, 80mm→48 chars */
const COL_WIDTH = {58: 32, 80: 48} as const;

function hr(width: 58 | 80): string {
  return width === 80 ? HL.HR_80MM : HL.HR_58MM;
}

/** Left-right two-column row, fills the full width */
function rowLR(left: string, right: string, w: number): string {
  const r = right.slice(0, w - 2);
  const l = left.slice(0, w - r.length - 1);
  return l.padEnd(w - r.length) + r;
}

/** Center-pad text */
function centerText(text: string, w: number): string {
  const t = text.slice(0, w);
  const pad = Math.max(0, Math.floor((w - t.length) / 2));
  return ' '.repeat(pad) + t;
}

// ── KOT receipt builder ───────────────────────────────────────────────────────

function buildKotText(
  kot: Kot,
  lines: OrderLine[],
  order: Order | null,
  width: 58 | 80,
): string {
  const w = COL_WIDTH[width];
  const h = hr(width);
  let t = '';

  t += TF.TXT_ALIGN_CT + TF.TXT_BOLD_ON;
  t += 'KITCHEN ORDER TICKET' + LF;
  t += TF.TXT_BOLD_OFF;
  t += h + LF;

  t += TF.TXT_ALIGN_LT;
  if (order?.tableName) {
    t += `Table : ${order.tableName}` + LF;
  }
  if (order?.orderType) {
    t += `Type  : ${order.orderType.replace('_', ' ')}` + LF;
  }
  t += `KOT   : ${kot.id.slice(-8).toUpperCase()}` + LF;
  t += `Time  : ${new Date().toLocaleTimeString()} ${new Date().toLocaleDateString()}` + LF;
  t += h + LF;

  t += TF.TXT_BOLD_ON + `${'QTY'.padEnd(5)}ITEM` + LF + TF.TXT_BOLD_OFF;
  t += h + LF;

  for (const l of lines) {
    const qty = String(l.quantity).padEnd(5);
    const name = l.itemName.slice(0, w - 5);
    t += qty + name + LF;
    if (l.variantName) {
      t += '     ' + l.variantName.slice(0, w - 5) + LF;
    }
    if (l.note) {
      t += '     Note: ' + l.note.slice(0, w - 11) + LF;
    }
  }

  t += h + LF + LF + LF;
  return t;
}

// ── Bill receipt builder ──────────────────────────────────────────────────────

function buildReceiptText(
  order: Order,
  lines: OrderLine[],
  width: 58 | 80,
): string {
  const w = COL_WIDTH[width];
  const h = hr(width);
  let t = '';

  // Header
  t += TF.TXT_ALIGN_CT;
  t += TF.TXT_BOLD_ON + TF.TXT_2HEIGHT;
  t += 'Zazzy POS' + LF;
  t += TF.TXT_NORMAL;
  t += h + LF;

  // Order info
  t += TF.TXT_ALIGN_LT;
  if (order.tableName) {
    t += `Table  : ${order.tableName}` + LF;
  }
  t += `Type   : ${order.orderType.replace('_', ' ')}` + LF;
  t += `Date   : ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}` + LF;
  t += h + LF;

  // Items header
  t += TF.TXT_BOLD_ON;
  t += rowLR('ITEM', 'AMT', w) + LF;
  t += TF.TXT_BOLD_OFF;
  t += h + LF;

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  for (const l of lines) {
    const label =
      `${l.itemName}${l.variantName ? ' · ' + l.variantName : ''} x${l.quantity}`;
    const amt = (l.price * l.quantity).toFixed(2);
    t += rowLR(label, amt, w) + LF;
  }

  // Totals
  t += h + LF;
  t += rowLR('Subtotal', subtotal.toFixed(2), w) + LF;

  const cgst = order.cgstTotal ?? 0;
  const sgst = order.sgstTotal ?? 0;
  if (cgst + sgst > 0) {
    t += rowLR('CGST', cgst.toFixed(2), w) + LF;
    t += rowLR('SGST', sgst.toFixed(2), w) + LF;
  }

  t += h + LF;
  t += TF.TXT_BOLD_ON;
  t += rowLR('TOTAL', `Rs.${order.totalAmount.toFixed(2)}`, w) + LF;
  t += TF.TXT_BOLD_OFF;
  t += h + LF;

  // Payment
  if (order.paymentMode) {
    t += rowLR('Mode', order.paymentMode.toUpperCase(), w) + LF;
  }
  const tendered = order.amountTendered ?? 0;
  if (tendered > 0) {
    t += rowLR('Cash', tendered.toFixed(2), w) + LF;
    const change = order.changeAmount ?? 0;
    if (change > 0) {
      t += rowLR('Change', change.toFixed(2), w) + LF;
    }
  }

  // Footer
  t += h + LF;
  t += TF.TXT_ALIGN_CT;
  t += centerText('Thank you! Visit again!', w) + LF;
  t += h + LF + LF + LF;

  return t;
}

// ── HTML builders for system print ───────────────────────────────────────────

const HTML_STYLE = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #000;
      max-width: 380px;
      margin: 0 auto;
      padding: 12px;
    }
    h1 { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 6px; }
    h2 { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 4px; }
    .hr { border-top: 1px solid #000; margin: 6px 0; }
    .hr-double { border-top: 3px double #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .row .label { flex: 1; }
    .row .value { text-align: right; padding-left: 8px; white-space: nowrap; }
    .bold { font-weight: bold; }
    .center { text-align: center; }
    .small { font-size: 11px; color: #444; }
    .indent { padding-left: 20px; font-size: 11px; color: #444; }
    .item-row { display: flex; align-items: flex-start; margin: 2px 0; }
    .item-qty { width: 32px; font-weight: bold; flex-shrink: 0; }
    .item-name { flex: 1; }
    .item-amt { text-align: right; padding-left: 8px; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 4px; text-align: left; }
    th { font-weight: bold; border-bottom: 1px solid #000; }
    .text-right { text-align: right; }
    .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; }
    .footer { text-align: center; margin-top: 12px; font-size: 12px; }
  </style>
`;

function buildKotHtml(
  kot: Kot,
  lines: OrderLine[],
  order: Order | null,
): string {
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  const date = new Date().toLocaleDateString();

  const itemRows = lines
    .map(
      l => `
        <tr>
          <td class="bold">${l.quantity}×</td>
          <td>
            ${l.itemName}
            ${l.variantName ? `<div class="small">↳ ${l.variantName}</div>` : ''}
            ${l.note ? `<div class="small">📝 ${l.note}</div>` : ''}
          </td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">${HTML_STYLE}</head><body>
  <h1>KITCHEN ORDER TICKET</h1>
  <div class="hr-double"></div>
  <div class="row">
    ${order?.tableName ? `<span><b>Table:</b> ${order.tableName}</span>` : '<span></span>'}
    <span><b>Time:</b> ${time}</span>
  </div>
  <div class="row">
    ${order?.orderType ? `<span><b>Type:</b> ${order.orderType.replace(/_/g, ' ')}</span>` : '<span></span>'}
    <span><b>Date:</b> ${date}</span>
  </div>
  <div class="row small"><span>KOT#: ${kot.id.slice(-8).toUpperCase()}</span></div>
  <div class="hr-double"></div>
  <table>
    <thead><tr><th>Qty</th><th>Item</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="hr"></div>
  <div class="footer small">— End of KOT —</div>
</body></html>`;
}

function buildReceiptHtml(order: Order, lines: OrderLine[]): string {
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  const date = new Date().toLocaleDateString();
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity + (l.modifiersTotal ?? 0), 0);
  const cgst = order.cgstTotal ?? 0;
  const sgst = order.sgstTotal ?? 0;
  const total = order.totalAmount ?? subtotal + cgst + sgst;
  const tendered = order.amountTendered ?? 0;
  const change = order.changeAmount ?? 0;

  const itemRows = lines
    .map(
      l => `
        <tr>
          <td>${l.itemName}${l.variantName ? `<div class="small">↳ ${l.variantName}</div>` : ''}</td>
          <td class="text-right">${l.quantity}</td>
          <td class="text-right">${l.price.toFixed(2)}</td>
          <td class="text-right">${(l.price * l.quantity + (l.modifiersTotal ?? 0)).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">${HTML_STYLE}</head><body>
  <h1>Zazzy POS</h1>
  <div class="hr-double"></div>
  <div class="row">
    ${order.tableName ? `<span><b>Table:</b> ${order.tableName}</span>` : '<span></span>'}
    <span>${date} ${time}</span>
  </div>
  <div class="row small">
    <span>Type: ${order.orderType?.replace(/_/g, ' ') ?? ''}</span>
    <span>Order #${order.id.slice(-6).toUpperCase()}</span>
  </div>
  <div class="hr-double"></div>
  <table>
    <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amt</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="hr"></div>
  <div class="row"><span class="label">Subtotal</span><span class="value">₹${subtotal.toFixed(2)}</span></div>
  ${cgst > 0 ? `<div class="row small"><span class="label">CGST</span><span class="value">₹${cgst.toFixed(2)}</span></div>` : ''}
  ${sgst > 0 ? `<div class="row small"><span class="label">SGST</span><span class="value">₹${sgst.toFixed(2)}</span></div>` : ''}
  <div class="hr-double"></div>
  <div class="row bold"><span class="label" style="font-size:15px">TOTAL</span><span class="value" style="font-size:15px">₹${total.toFixed(2)}</span></div>
  <div class="hr"></div>
  ${order.paymentMode ? `<div class="row small"><span class="label">Payment</span><span class="value">${order.paymentMode.toUpperCase()}</span></div>` : ''}
  ${tendered > 0 ? `<div class="row small"><span class="label">Cash tendered</span><span class="value">₹${tendered.toFixed(2)}</span></div>` : ''}
  ${change > 0 ? `<div class="row small"><span class="label">Change</span><span class="value">₹${change.toFixed(2)}</span></div>` : ''}
  <div class="footer" style="margin-top:16px">
    <div class="bold">Thank you! Visit again 🙏</div>
    <div class="small" style="margin-top:4px">Powered by Zazzy POS</div>
  </div>
</body></html>`;
}

// ── Android BT permissions ────────────────────────────────────────────────────

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

// ── Device list helpers (used by PrinterScreen) ───────────────────────────────

export async function getBluetoothDevices(): Promise<IBLEPrinter[]> {
  await requestBluetoothPermissions();
  await BLEPrinter.init();
  return BLEPrinter.getDeviceList();
}

export async function getUsbDevices(): Promise<IUSBPrinter[]> {
  await USBPrinter.init();
  return USBPrinter.getDeviceList();
}

// ── Core connect + print ──────────────────────────────────────────────────────

async function connectAndPrint(text: string): Promise<void> {
  if (Platform.OS === 'windows') {
    throw new Error(
      'ESC/POS printing is not supported on Windows. Use System print or a Network printer via the thermal printer server.',
    );
  }
  const s = usePrinterStore.getState();
  const opts = {cut: true, beep: false, tailingLine: true};

  switch (s.connectionType) {
    case 'bluetooth': {
      if (!s.btMac) throw new Error('No Bluetooth printer set. Go to Settings → Printer.');
      await requestBluetoothPermissions();
      await BLEPrinter.init();
      await BLEPrinter.connectPrinter(s.btMac);
      BLEPrinter.printBill(text, opts);
      break;
    }
    case 'network': {
      if (!s.netIp) throw new Error('No network printer IP set. Go to Settings → Printer.');
      await NetPrinter.init();
      await NetPrinter.connectPrinter(s.netIp, s.netPort || 9100);
      NetPrinter.printBill(text, opts);
      break;
    }
    case 'usb': {
      if (!s.usbVendorId || !s.usbProductId) {
        throw new Error('No USB printer set. Go to Settings → Printer.');
      }
      await USBPrinter.init();
      await USBPrinter.connectPrinter(s.usbVendorId, s.usbProductId);
      USBPrinter.printBill(text, opts);
      break;
    }
    case 'system':
      // system print is handled separately via connectAndPrintHtml
      break;
  }
}

async function connectAndPrintHtml(html: string, jobName: string): Promise<void> {
  if (Platform.OS === 'windows') {
    // react-native-print has no Windows implementation.
    // On Windows, open the HTML in the default browser / print dialog instead.
    throw new Error(
      'System print dialog not yet supported on Windows. Please use Network printer mode.',
    );
  }
  await RNPrint.print({html, jobName});
}

// ── Public print functions ────────────────────────────────────────────────────

export async function printKot(kotLocalId: string): Promise<void> {
  const [kot, lines] = await Promise.all([
    kotsCollection.find(kotLocalId),
    orderLinesCollection.query(Q.where('kot_id', kotLocalId)).fetch(),
  ]);

  let order: Order | null = null;
  try {
    order = await ordersCollection.find((kot as any).orderId);
  } catch {}

  const {connectionType, paperWidth} = usePrinterStore.getState();

  if (connectionType === 'system') {
    const html = buildKotHtml(kot, lines, order);
    await connectAndPrintHtml(html, 'KOT');
  } else {
    const text = buildKotText(kot, lines, order, paperWidth as 58 | 80);
    await connectAndPrint(text);
  }
}

export async function printReceipt(orderLocalId: string): Promise<void> {
  const [order, lines] = await Promise.all([
    ordersCollection.find(orderLocalId),
    orderLinesCollection.query(Q.where('order_id', orderLocalId)).fetch(),
  ]);

  const {connectionType, paperWidth} = usePrinterStore.getState();

  if (connectionType === 'system') {
    const html = buildReceiptHtml(order, lines);
    await connectAndPrintHtml(html, 'Receipt');
  } else {
    const text = buildReceiptText(order, lines, paperWidth as 58 | 80);
    await connectAndPrint(text);
  }
}

export async function testPrint(): Promise<void> {
  const {connectionType, paperWidth} = usePrinterStore.getState();

  if (connectionType === 'system') {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">${HTML_STYLE}</head><body>
  <h1>TEST PRINT</h1>
  <div class="hr-double"></div>
  <div class="center">Zazzy POS</div>
  <div class="center small">${new Date().toLocaleString()}</div>
  <div class="hr"></div>
  <div class="center bold">System print is working! ✓</div>
  <div class="hr-double"></div>
  <div class="footer small">This page was printed via Android system print.</div>
</body></html>`;
    await connectAndPrintHtml(html, 'Test Print');
    return;
  }

  const w = COL_WIDTH[paperWidth as 58 | 80];
  const h = hr(paperWidth as 58 | 80);

  let text = '';
  text += TF.TXT_ALIGN_CT + TF.TXT_BOLD_ON;
  text += 'TEST PRINT' + LF;
  text += TF.TXT_BOLD_OFF;
  text += h + LF;
  text += centerText('Zazzy POS', w) + LF;
  text += centerText(`Paper: ${paperWidth}mm`, w) + LF;
  text += centerText(new Date().toLocaleString(), w) + LF;
  text += h + LF;
  text += TF.TXT_ALIGN_CT + 'Printer connected!' + LF;
  text += h + LF + LF + LF;

  await connectAndPrint(text);
}
