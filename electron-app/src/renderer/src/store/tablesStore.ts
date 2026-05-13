import { create } from 'zustand'
import { ipc } from '../bridge/ipc'
import type { DiningTable, TableStatus } from '../types'

interface TablesState {
  tables: DiningTable[]
  isLoaded: boolean
  loadTables: () => Promise<void>
  updateTableStatus: (tableId: string, status: TableStatus, currentOrderId: string | null) => void
  setTables: (tables: DiningTable[]) => void
}

export const useTablesStore = create<TablesState>((set) => ({
  tables: [],
  isLoaded: false,

  loadTables: async () => {
    const raw = (await ipc.tables.getAll()) as DiningTable[]
    set({ tables: raw, isLoaded: true })
  },

  // Zustand update is synchronous (instant UI). SQLite write-behind is fire-and-forget.
  updateTableStatus: (tableId, status, currentOrderId) => {
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, status, current_order_id: currentOrderId } : t,
      ),
    }))
    ipc.tables.updateStatus(tableId, status, currentOrderId).catch(() => {})
  },

  setTables: (tables) => set({ tables }),
}))
