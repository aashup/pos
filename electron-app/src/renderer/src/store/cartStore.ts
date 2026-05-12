import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { calcGST, calcRoundOff } from '../lib/utils'
import type { CartLine, Combo, Item, ItemVariant, OrderType, SelectedModifier } from '../types'

interface CartTotals {
  subtotal: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  grandTotal: number
  roundOff: number
  netPayable: number
}

interface CartState {
  orderId: string | null        // server UUID (set when order pushed to server or resumed occupied table)
  localOrderId: string | null   // local SQLite UUID (set when order created offline-first)
  orderType: OrderType
  tableId: string | null
  tableName: string | null
  pax: number
  lines: CartLine[]
  isInterState: boolean
  discountPct: number
  totals: CartTotals

  // Order management
  setOrder: (orderId: string, orderType: OrderType, tableId?: string, tableName?: string) => void
  setLocalOrder: (localOrderId: string, orderType: OrderType, tableId?: string, tableName?: string) => void
  clearOrder: () => void
  setOrderType: (type: OrderType) => void
  setTable: (tableId: string, tableName: string, pax?: number) => void
  clearTable: () => void
  setPax: (pax: number) => void
  setDiscount: (pct: number) => void

  // Cart operations
  addItem: (item: { id: string; name: string; selling_price: number; unit: string; cgst: number; sgst: number; igst: number }, lineId?: string) => void
  addVariantItem: (item: Item, variant: ItemVariant | null, modifiers: SelectedModifier[]) => void
  addCombo: (combo: Combo, modifiers: SelectedModifier[]) => void
  updateQty: (lineId: string, qty: number) => void
  removeItem: (lineId: string) => void
  setLineNotes: (lineId: string, notes: string) => void
  markLinesSent: (lineIds: string[]) => void
  clearCart: () => void
}

const ZERO_TOTALS: CartTotals = {
  subtotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0,
  grandTotal: 0, roundOff: 0, netPayable: 0,
}

function computeTotals(lines: CartLine[], isInterState: boolean, discountPct: number): CartTotals {
  let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0

  for (const l of lines) {
    const base = l.quantity * (l.rate + l.modifiersTotal)
    const taxable = base * (1 - (l.discountPct + discountPct) / 100)
    const gst = calcGST(taxable, l.gstRate, isInterState)
    subtotal += taxable
    cgstTotal += gst.cgst
    sgstTotal += gst.sgst
    igstTotal += gst.igst
  }

  const { roundOff, netPayable } = calcRoundOff(subtotal + cgstTotal + sgstTotal + igstTotal)

  return {
    subtotal: +subtotal.toFixed(2),
    cgstTotal: +cgstTotal.toFixed(2),
    sgstTotal: +sgstTotal.toFixed(2),
    igstTotal: +igstTotal.toFixed(2),
    grandTotal: +(subtotal + cgstTotal + sgstTotal + igstTotal).toFixed(2),
    roundOff,
    netPayable,
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  orderId: null,
  localOrderId: null,
  orderType: 'takeaway',
  tableId: null,
  tableName: null,
  pax: 1,
  lines: [],
  isInterState: false,
  discountPct: 0,
  totals: ZERO_TOTALS,

  // Set a server-side order (occupied table resume, or after inline server creation)
  setOrder: (orderId, orderType, tableId, tableName) =>
    set({ orderId, orderType, tableId: tableId ?? null, tableName: tableName ?? null }),

  // Set a locally-created order (offline-first: takeaway, delivery, vacant dine_in)
  setLocalOrder: (localOrderId, orderType, tableId, tableName) =>
    set({ localOrderId, orderId: null, orderType, tableId: tableId ?? null, tableName: tableName ?? null }),

  clearOrder: () =>
    set({ orderId: null, localOrderId: null, orderType: 'takeaway', tableId: null, tableName: null, pax: 1, lines: [], discountPct: 0, totals: ZERO_TOTALS }),

  setOrderType: (type) => set({ orderType: type }),

  setTable: (tableId, tableName, pax = 1) => set({ tableId, tableName, pax, orderType: 'dine_in' }),

  clearTable: () => set({ tableId: null, tableName: null }),

  setPax: (pax) => set({ pax }),

  setDiscount: (pct) => {
    const { lines, isInterState } = get()
    set({ discountPct: pct, totals: computeTotals(lines, isInterState, pct) })
  },

  addItem: (item, lineId) => {
    const { lines, isInterState, discountPct } = get()
    const gstRate = item.cgst + item.sgst + item.igst

    // Increment quantity if same bare item (no variant, no modifiers) already in cart and not yet sent
    const existing = lines.find(
      (l) => l.itemId === item.id && !l.variantId && l.selectedModifiers.length === 0 && l.kotStatus === 'pending'
    )
    let newLines: CartLine[]

    if (existing) {
      newLines = lines.map((l) =>
        l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l,
      )
    } else {
      const newLine: CartLine = {
        id: lineId ?? uuidv4(),
        itemId: item.id,
        comboId: null,
        name: item.name,
        rate: item.selling_price ?? 0,
        unit: item.unit,
        gstRate,
        quantity: 1,
        discountPct: 0,
        modifiersTotal: 0,
        kotStatus: 'pending',
        notes: '',
        variantId: null,
        variantName: null,
        selectedModifiers: [],
      }
      newLines = [...lines, newLine]
    }

    set({ lines: newLines, totals: computeTotals(newLines, isInterState, discountPct) })
  },

  addVariantItem: (item, variant, modifiers) => {
    const { lines, isInterState, discountPct } = get()
    const gstRate = item.cgst + item.sgst + item.igst
    const rate = variant?.price_override ?? item.selling_price ?? 0
    const modifiersTotal = modifiers.reduce((sum, m) => sum + m.price, 0)

    const newLine: CartLine = {
      id: uuidv4(),
      itemId: item.id,
      comboId: null,
      name: item.name,
      rate,
      unit: item.unit,
      gstRate,
      quantity: 1,
      discountPct: 0,
      modifiersTotal,
      kotStatus: 'pending',
      notes: '',
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      selectedModifiers: modifiers,
    }
    const newLines = [...lines, newLine]
    set({ lines: newLines, totals: computeTotals(newLines, isInterState, discountPct) })
  },

  addCombo: (combo, modifiers) => {
    const { lines, isInterState, discountPct } = get()
    const gstRate = combo.cgst + combo.sgst + combo.igst
    const modifiersTotal = modifiers.reduce((sum, m) => sum + m.price, 0)

    const newLine: CartLine = {
      id: uuidv4(),
      itemId: '',
      comboId: combo.id,
      name: combo.name,
      rate: combo.price,
      unit: 'NOS',
      gstRate,
      quantity: 1,
      discountPct: 0,
      modifiersTotal,
      kotStatus: 'pending',
      notes: '',
      variantId: null,
      variantName: null,
      selectedModifiers: modifiers,
    }
    const newLines = [...lines, newLine]
    set({ lines: newLines, totals: computeTotals(newLines, isInterState, discountPct) })
  },

  updateQty: (lineId, qty) => {
    const { lines, isInterState, discountPct } = get()
    const newLines = qty <= 0
      ? lines.filter((l) => l.id !== lineId)
      : lines.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l))
    set({ lines: newLines, totals: computeTotals(newLines, isInterState, discountPct) })
  },

  removeItem: (lineId) => {
    const { lines, isInterState, discountPct } = get()
    const newLines = lines.filter((l) => l.id !== lineId)
    set({ lines: newLines, totals: computeTotals(newLines, isInterState, discountPct) })
  },

  setLineNotes: (lineId, notes) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === lineId ? { ...l, notes } : l)) })),

  markLinesSent: (lineIds) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        lineIds.includes(l.id) ? { ...l, kotStatus: 'sent' as const } : l,
      ),
    })),

  clearCart: () => set({ lines: [], discountPct: 0, totals: ZERO_TOTALS }),
}))
