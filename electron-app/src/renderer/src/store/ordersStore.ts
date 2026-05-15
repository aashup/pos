import { create } from 'zustand'
import { ipc } from '../bridge/ipc'
import type { LocalOrderSummary, LocalHeldOrder } from '../bridge/ipc'

interface OrdersState {
  orders: LocalOrderSummary[]
  heldOrders: LocalHeldOrder[]
  isLoaded: boolean
  loadOrders(): Promise<void>
  loadHeldOrders(): Promise<void>
  upsertOrder(update: Partial<LocalOrderSummary> & { id: string }): void
  removeOrder(id: string): void
  removeHeld(id: string): void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  heldOrders: [],
  isLoaded: false,

  async loadOrders() {
    const data = await ipc.order.list({ status: 'draft' })
    set({ orders: data, isLoaded: true })
  },

  async loadHeldOrders() {
    const data = await ipc.order.listHeld()
    set({ heldOrders: data })
  },

  upsertOrder(update) {
    set((s) => {
      const idx = s.orders.findIndex((o) => o.id === update.id)
      if (idx >= 0) {
        const next = [...s.orders]
        next[idx] = { ...next[idx], ...update }
        return { orders: next }
      }
      return { orders: [update as LocalOrderSummary, ...s.orders] }
    })
  },

  removeOrder(id) {
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
      heldOrders: s.heldOrders.filter((o) => o.id !== id),
    }))
  },

  removeHeld(id) {
    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== id),
      orders: s.orders.map((o) => (o.id === id ? { ...o, pos_held: 0 } : o)),
    }))
  },
}))
