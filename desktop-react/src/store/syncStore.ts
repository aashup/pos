import { create } from 'zustand';

interface SyncStore {
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: number | null;
  errors: string[];
  setSyncing: () => void;
  setSynced: () => void;
  setError: (error: string) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  errors: [],

  setSyncing: () => set({ status: 'syncing', errors: [] }),

  setSynced: () => set({ status: 'idle', lastSyncAt: Date.now(), errors: [] }),

  setError: (error) =>
    set((state) => ({
      status: 'error',
      errors: [...state.errors, error],
    })),
}));
