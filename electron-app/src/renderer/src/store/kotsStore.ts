import { create } from 'zustand'
import { ipc, type LocalKot } from '../bridge/ipc'

interface KotsState {
  kots: LocalKot[]
  isLoaded: boolean
  loadKots(): Promise<void>
  updateKotStatus(id: string, status: LocalKot['status']): void
  updateLineStatus(kotId: string, lineId: string, status: string): void
}

export const useKotsStore = create<KotsState>((set) => ({
  kots: [],
  isLoaded: false,

  async loadKots() {
    const data = await ipc.kots.list()
    set({ kots: data, isLoaded: true })
  },

  updateKotStatus(id, status) {
    set((s) => ({
      kots: status === 'served'
        ? s.kots.filter((k) => k.id !== id)
        : s.kots.map((k) => (k.id === id ? { ...k, status } : k)),
    }))
  },

  updateLineStatus(kotId, lineId, status) {
    set((s) => ({
      kots: s.kots.map((k) =>
        k.id !== kotId ? k : {
          ...k,
          lines: k.lines.map((l) => (l.id === lineId ? { ...l, status } : l)),
        },
      ),
    }))
  },
}))
