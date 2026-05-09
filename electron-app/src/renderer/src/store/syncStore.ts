import { create } from 'zustand'

interface SyncState {
  status: 'idle' | 'syncing' | 'error'
  lastSyncAt: string | null
  pendingCount: number
  errors: string[]
  setStatus: (status: 'idle' | 'syncing' | 'error') => void
  setSyncResult: (result: { lastSyncAt: string | null; errors: string[] }) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  errors: [],
  setStatus: (status) => set({ status }),
  setSyncResult: ({ lastSyncAt, errors }) =>
    set({ lastSyncAt, errors, status: errors.length ? 'error' : 'idle' }),
}))
