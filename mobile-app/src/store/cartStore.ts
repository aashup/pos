import { create } from 'zustand';
import { calcGST, calcRoundOff } from '@/lib/utils';

export interface SelectedModifier {
  id: string;
  name: string;
  price: number;
}

export interface CartLine {
  lineId: string; // unique per line (uuid)
  itemId: string; // server_id of the item
  itemName: string;
  price: number; // base price (variant price or item price)
  quantity: number;
  note: string | null;
  sent: boolean; // true once KOT sent for this line
  kotStatus: 'pending' | 'sent' | 'cooking' | 'ready' | 'served';
  cgstPct: number;
  sgstPct: number;
  variantId: string | null;
  variantName: string | null;
  selectedModifiers: SelectedModifier[];
  modifiersTotal: number;
}

type OrderType = 'dine_in' | 'takeaway' | 'delivery';

interface TableInfo {
  id: string; // local WatermelonDB id
  serverId: string;
  name: string;
}

interface CartTotals {
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  roundOff: number;
  netPayable: number;
  unsentCount: number;
}

interface CartState {
  localOrderId: string | null;
  serverId: string | null;
  table: TableInfo | null;
  orderType: OrderType;
  lines: CartLine[];

  setTable: (table: TableInfo) => void;
  setLocalOrderId: (id: string) => void;
  setServerId: (id: string) => void;
  setOrderType: (type: OrderType) => void;
  addItem: (item: {
    itemId: string;
    itemName: string;
    price: number;
    cgstPct?: number;
    sgstPct?: number;
    variantId?: string | null;
    variantName?: string | null;
    selectedModifiers?: SelectedModifier[];
  }) => void;
  removeItem: (lineId: string) => void;
  incrementQty: (lineId: string) => void;
  decrementQty: (lineId: string) => void;
  setNote: (lineId: string, note: string) => void;
  markLinesSent: () => void;
  populateLines: (lines: CartLine[], localOrderId?: string) => void;
  clearOrder: () => void;
  computeTotals: () => CartTotals;
}

function makeLineId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useCartStore = create<CartState>((set, get) => ({
  localOrderId: null,
  serverId: null,
  table: null,
  orderType: 'dine_in',
  lines: [],

  setTable: (table) => set({ table, localOrderId: null, serverId: null, lines: [], orderType: 'dine_in' }),

  setLocalOrderId: (id) => set({ localOrderId: id }),

  setServerId: (id) => set({ serverId: id }),

  setOrderType: (type) => set({ orderType: type }),

  addItem: ({ itemId, itemName, price, cgstPct = 0, sgstPct = 0, variantId = null, variantName = null, selectedModifiers = [] }) => {
    set((state) => {
      const modifiersTotal = selectedModifiers.reduce((s, m) => s + m.price, 0);
      // Increment qty only if same item + same variant + no modifiers + pending
      const existing = state.lines.find(
        (l) =>
          l.itemId === itemId &&
          l.variantId === variantId &&
          l.selectedModifiers.length === 0 &&
          selectedModifiers.length === 0 &&
          !l.sent,
      );
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      const newLine: CartLine = {
        lineId: makeLineId(),
        itemId,
        itemName,
        price: price + modifiersTotal,
        quantity: 1,
        note: null,
        sent: false,
        kotStatus: 'pending',
        cgstPct,
        sgstPct,
        variantId,
        variantName,
        selectedModifiers,
        modifiersTotal,
      };
      return { lines: [...state.lines, newLine] };
    });
  },

  removeItem: (lineId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId || l.sent) })),

  incrementQty: (lineId) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.lineId === lineId && !l.sent ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    })),

  decrementQty: (lineId) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.lineId === lineId && !l.sent ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    })),

  setNote: (lineId, note) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId && !l.sent ? { ...l, note } : l)),
    })),

  markLinesSent: () =>
    set((state) => ({
      lines: state.lines.map((l) => ({ ...l, sent: true, kotStatus: 'sent' })),
    })),

  populateLines: (lines, localOrderId) =>
    set((state) => ({
      lines,
      localOrderId: localOrderId ?? state.localOrderId,
    })),

  clearOrder: () => set({ localOrderId: null, serverId: null, table: null, lines: [], orderType: 'dine_in' }),

  computeTotals: (): CartTotals => {
    const { lines } = get();
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let unsentCount = 0;

    for (const line of lines) {
      const lineTotal = line.price * line.quantity;
      subtotal += lineTotal;
      const { cgst, sgst } = calcGST(lineTotal, line.cgstPct, line.sgstPct);
      cgstTotal += cgst;
      sgstTotal += sgst;
      if (!line.sent) unsentCount += line.quantity;
    }

    const { netPayable, roundOff } = calcRoundOff(subtotal + cgstTotal + sgstTotal);
    return { subtotal, cgstTotal, sgstTotal, roundOff, netPayable, unsentCount };
  },
}));
