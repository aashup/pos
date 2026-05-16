// Re-export shared types from bridge so renderer code has a single import point.
export type { LocalPrintTemplate, TemplateType } from '../bridge/ipc'

export type PrintResult = { success: boolean; error?: string }

// ── KOT ──────────────────────────────────────────────────────────────────────

export interface KotTemplateData {
  kotNumber: string
  tableName?: string
  orderType: string
  pax?: number
  items: { name: string; quantity: number; notes?: string }[]
  notes?: string
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  name: string
  quantity: number
  rate: number
  gstRate: number
  lineTotal: number
}

export interface SplitPayment {
  mode: 'cash' | 'upi' | 'card' | 'credit'
  amount: number
  tendered?: number
}

export interface InvoiceTemplateData {
  outletName: string
  outletAddress?: string
  outletPhone?: string
  outletGstin?: string
  invoiceNumber: string
  invoiceDate: string
  orderType: string
  tableName?: string
  items: InvoiceLineItem[]
  subtotal: number
  cgst: number
  sgst: number
  discount: number
  grandTotal: number
  paymentMode: string
  amountTendered?: number
  change?: number
  splitPayments?: SplitPayment[]
  customerName?: string
  footerNote?: string
}
