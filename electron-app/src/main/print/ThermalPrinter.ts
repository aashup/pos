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

export async function listPrinters(): Promise<string[]> {
  try {
    // Electron's webContents.getPrintersAsync is not accessible from main without a window
    // Return placeholder; real printer list fetched via ipc from renderer
    return []
  } catch {
    return []
  }
}
