import { create } from 'zustand';

export interface CartLine {
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  note?: string;
  sent: boolean; // true once a KOT has been sent for this line
}

interface TableInfo {
  id: string; // local WatermelonDB id
  serverId: string;
  name: string;
}

interface CartState {
  localOrderId: string | null; // WatermelonDB Order row id
  serverId: string | null; // backend UUID, set after first push
  table: TableInfo | null;
  lines: CartLine[];

  setTable: (table: TableInfo) => void;
  setLocalOrderId: (id: string) => void;
  setServerId: (id: string) => void;
  addItem: (item: { itemId: string; itemName: string; price: number }) => void;
  removeItem: (itemId: string) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  setNote: (itemId: string, note: string) => void;
  markLinesSent: () => void;
  clearOrder: () => void;
  computeTotals: () => { subtotal: number; total: number; unsentCount: number };
}

export const useCartStore = create<CartState>((set, get) => ({
  localOrderId: null,
  serverId: null,
  table: null,
  lines: [],

  setTable: (table) => set({ table, localOrderId: null, serverId: null, lines: [] }),

  setLocalOrderId: (id) => set({ localOrderId: id }),

  setServerId: (id) => set({ serverId: id }),

  addItem: ({ itemId, itemName, price }) => {
    set((state) => {
      const existing = state.lines.find((l) => l.itemId === itemId && !l.sent);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return {
        lines: [...state.lines, { itemId, itemName, price, quantity: 1, sent: false }],
      };
    });
  },

  removeItem: (itemId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.itemId !== itemId || l.sent) })),

  incrementQty: (itemId) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.itemId === itemId && !l.sent ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    })),

  decrementQty: (itemId) =>
    set((state) => ({
      lines: state.lines
        .map((l) =>
          l.itemId === itemId && !l.sent ? { ...l, quantity: l.quantity - 1 } : l,
        )
        .filter((l) => l.quantity > 0),
    })),

  setNote: (itemId, note) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.itemId === itemId && !l.sent ? { ...l, note } : l)),
    })),

  markLinesSent: () =>
    set((state) => ({ lines: state.lines.map((l) => ({ ...l, sent: true })) })),

  clearOrder: () => set({ localOrderId: null, serverId: null, table: null, lines: [] }),

  computeTotals: () => {
    const { lines } = get();
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const unsentCount = lines.filter((l) => !l.sent).reduce((sum, l) => sum + l.quantity, 0);
    return { subtotal, total: subtotal, unsentCount };
  },
}));
