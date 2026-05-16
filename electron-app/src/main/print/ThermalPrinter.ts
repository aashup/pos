import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { TokenStore } from '../auth/TokenStore'

export interface ReceiptData {
  outletName: string
  outletAddress?: string
  outletPhone?: string
  outletGstin?: string
  invoiceNumber: string
  invoiceDate: string
  orderType: string
  tableName?: string
  items: { name: string; quantity: number; rate: number; gstRate: number; lineTotal: number }[]
  subtotal: number
  cgst: number
  sgst: number
  discount: number
  grandTotal: number
  paymentMode: string
  amountTendered?: number
  change?: number
  footerNote?: string
}

export interface KOTData {
  kotNumber: string
  tableName?: string
  orderType: string
  pax?: number
  items: { name: string; quantity: number; notes?: string }[]
  notes?: string
}

function getPrinterName(): string {
  return TokenStore.getSetting('printerName') ?? ''
}

function getPaperWidth(): number {
  const w = TokenStore.getSetting('paperWidth')
  return w === '58' ? 32 : 48  // chars per line
}

function buildPrinter(printerName: string): ThermalPrinter | null {
  if (!printerName) return null
  try {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `printer:${printerName}`,
      characterSet: CharacterSet.PC437_USA,
      removeSpecialCharacters: false,
      lineCharacter: '-',
    })
  } catch {
    return null
  }
}

function line(width: number): string {
  return '-'.repeat(width)
}

function padRight(text: string, width: number): string {
  return text.padEnd(width).slice(0, width)
}

function padLeft(text: string, width: number): string {
  return text.padStart(width).slice(-width)
}

function row(label: string, value: string, width: number): string {
  const space = width - label.length - value.length
  if (space <= 0) return label + ' ' + value
  return label + ' '.repeat(space) + value
}

export async function printReceipt(data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  const printerName = getPrinterName()
  const printer     = buildPrinter(printerName)
  const w           = getPaperWidth()

  if (!printer) {
    return { success: false, error: 'No printer configured. Set printer name in settings.' }
  }

  try {
    printer.alignCenter()
    printer.bold(true)
    printer.println(data.outletName)
    printer.bold(false)
    if (data.outletAddress) printer.println(data.outletAddress)
    if (data.outletPhone)   printer.println(`Ph: ${data.outletPhone}`)
    if (data.outletGstin)   printer.println(`GSTIN: ${data.outletGstin}`)
    printer.println(line(w))

    printer.alignLeft()
    printer.println(`Invoice: ${data.invoiceNumber}`)
    printer.println(`Date:    ${data.invoiceDate}`)
    printer.println(`Type:    ${data.orderType.replace('_',' ')}${data.tableName ? ` (${data.tableName})` : ''}`)
    printer.println(line(w))

    // Items
    printer.bold(true)
    printer.println(padRight('Item', w - 14) + padLeft('Qty', 5) + padLeft('Amt', 9))
    printer.bold(false)
    printer.println(line(w))

    for (const item of data.items) {
      const nameCol = padRight(item.name, w - 14)
      const qtyCol  = padLeft(`x${item.quantity}`, 5)
      const amtCol  = padLeft(item.lineTotal.toFixed(2), 9)
      printer.println(nameCol + qtyCol + amtCol)
      if (item.gstRate > 0) {
        printer.println(padLeft(`(GST ${item.gstRate}%)`, w))
      }
    }

    printer.println(line(w))

    // Totals
    if (data.discount > 0) {
      printer.println(row('Discount', `-${data.discount.toFixed(2)}`, w))
    }
    if (data.cgst > 0) {
      printer.println(row('CGST', data.cgst.toFixed(2), w))
      printer.println(row('SGST', data.sgst.toFixed(2), w))
    }
    printer.bold(true)
    printer.println(row('TOTAL', `Rs.${data.grandTotal.toFixed(2)}`, w))
    printer.bold(false)
    printer.println(line(w))

    printer.println(row('Payment', data.paymentMode.toUpperCase(), w))
    if (data.amountTendered !== undefined && data.paymentMode === 'cash') {
      printer.println(row('Tendered', `Rs.${data.amountTendered.toFixed(2)}`, w))
      printer.println(row('Change',   `Rs.${(data.change ?? 0).toFixed(2)}`, w))
    }
    printer.println(line(w))

    printer.alignCenter()
    printer.println(data.footerNote ?? 'Thank you! Visit again.')
    printer.println('')
    printer.cut()

    await printer.execute()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function printKOT(data: KOTData): Promise<{ success: boolean; error?: string }> {
  const kotPrinterName = TokenStore.getSetting('kotPrinterName') ?? getPrinterName()
  const printer        = buildPrinter(kotPrinterName)
  const w              = getPaperWidth()

  if (!printer) {
    return { success: false, error: 'No KOT printer configured.' }
  }

  try {
    printer.alignCenter()
    printer.bold(true)
    printer.setTextSize(1, 1)
    printer.println('KOT')
    printer.setTextNormal()
    printer.println(`#${data.kotNumber}`)
    printer.bold(false)
    printer.println(line(w))

    printer.alignLeft()
    printer.println(`${data.orderType.replace('_',' ')}${data.tableName ? ` - ${data.tableName}` : ''}`)
    if (data.pax) printer.println(`Guests: ${data.pax}`)
    printer.println(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }))
    printer.println(line(w))

    for (const item of data.items) {
      printer.bold(true)
      printer.println(`${item.quantity}x  ${item.name}`)
      printer.bold(false)
      if (item.notes) printer.println(`   ** ${item.notes}`)
    }

    printer.println(line(w))
    if (data.notes) {
      printer.println(`Note: ${data.notes}`)
      printer.println(line(w))
    }

    printer.cut()
    await printer.execute()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ── Template-driven KOT printing ─────────────────────────────────────────────
//
// Template syntax (text-based, ESC/POS markers):
//   ##CENTER   — align center for the rest of the line
//   ##LEFT     — align left (default)
//   ##BOLD     — bold on
//   ##/BOLD    — bold off
//   ##DIVIDER  — full-width horizontal rule
//   {{key}}    — scalar substitution (kotNumber, tableName, orderType, pax, notes, time)
//   {{#items}} ... {{/items}} — repeated block; inner {{name}}, {{quantity}}, {{notes}}
//
// Falls back to the hardcoded printKOT() layout if the template is empty or parsing fails.

function resolveToken(token: string, ctx: Record<string, string>): string {
  return ctx[token] ?? ''
}

function interpolate(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => resolveToken(k, ctx))
}

function applyDirectives(
  printer: ThermalPrinter,
  line: string,
  ctx: Record<string, string>,
  w: number,
): void {
  let remaining = line
  let isBold = false
  let isCenter = false

  // Extract leading directives
  while (remaining.startsWith('##')) {
    const end = remaining.indexOf(' ') === -1 ? remaining.length : remaining.indexOf(' ')
    // Directives can be adjacent: ##CENTER##BOLD text
    const nextHash = remaining.indexOf('##', 2)
    const directiveEnd = nextHash > 0 && nextHash < end ? nextHash : end
    const directive = remaining.slice(0, directiveEnd)
    remaining = remaining.slice(directiveEnd).trimStart()

    if (directive === '##CENTER')  { isCenter = true; printer.alignCenter() }
    else if (directive === '##LEFT')    { isCenter = false; printer.alignLeft() }
    else if (directive === '##BOLD')    { isBold = true;  printer.bold(true) }
    else if (directive === '##/BOLD')   { isBold = false; printer.bold(false) }
    else if (directive === '##DIVIDER') { printer.println(line(w)); return }
  }

  if (remaining.trim()) printer.println(interpolate(remaining, ctx))

  // Reset state after each line to avoid bleed-through
  if (isBold)   printer.bold(false)
  if (isCenter) printer.alignLeft()
}

export async function printKotFromTemplate(
  data: KOTData,
  layout: string,
): Promise<{ success: boolean; error?: string }> {
  if (!layout.trim()) return printKOT(data)

  const kotPrinterName = TokenStore.getSetting('kotPrinterName') ?? getPrinterName()
  const printer        = buildPrinter(kotPrinterName)
  const w              = getPaperWidth()

  if (!printer) return { success: false, error: 'No KOT printer configured.' }

  try {
    const scalarCtx: Record<string, string> = {
      kotNumber:  data.kotNumber,
      tableName:  data.tableName ?? '',
      orderType:  data.orderType.replace('_', ' '),
      pax:        data.pax != null ? String(data.pax) : '',
      notes:      data.notes ?? '',
      time:       new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    }

    // Split layout into the static part and the items block
    const itemsBlockRe = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/
    const itemsMatch   = layout.match(itemsBlockRe)
    const itemsBlock   = itemsMatch ? itemsMatch[1] : ''
    const parts        = layout.split(itemsBlockRe)
    // parts: [before, block-content, after] — block-content is index 1
    const beforeItems  = parts[0] ?? ''
    const afterItems   = parts[2] ?? ''

    for (const rawLine of beforeItems.split('\n')) {
      if (rawLine.trim()) applyDirectives(printer, rawLine, scalarCtx, w)
    }

    if (itemsBlock) {
      for (const item of data.items) {
        const itemCtx: Record<string, string> = {
          ...scalarCtx,
          name:     item.name,
          quantity: String(item.quantity),
          notes:    item.notes ?? '',
        }
        for (const rawLine of itemsBlock.split('\n')) {
          if (rawLine.trim()) applyDirectives(printer, rawLine, itemCtx, w)
        }
      }
    }

    for (const rawLine of afterItems.split('\n')) {
      if (rawLine.trim()) applyDirectives(printer, rawLine, scalarCtx, w)
    }

    printer.cut()
    await printer.execute()
    return { success: true }
  } catch (err) {
    // If template parsing produces a bad output, fall back to the standard layout
    try { printer.clear() } catch { /* ignore */ }
    return printKOT(data)
  }
}

export async function listPrinters(): Promise<string[]> {
  try {
    // Electron's webContents.getPrintersAsync is not accessible from main without a window
    // Return placeholder; real printer list fetched via ipc from renderer
    return []
  } catch {
    return []
  }
}
