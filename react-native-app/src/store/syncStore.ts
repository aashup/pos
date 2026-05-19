import {create} from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  status: SyncStatus;
  lastSyncAt: number | null;
  lastPulled: number;
  lastPushed: number;
  errors: string[];
  setStatus: (status: SyncStatus) => void;
  setLastSyncAt: (ts: number) => void;
  setLastPulled: (n: number) => void;
  setLastPushed: (n: number) => void;
  pushError: (msg: string) => void;
  clearErrors: () => void;
};

export const useSyncStore = create<SyncState>(set => ({
  status: 'idle',
  lastSyncAt: null,
  lastPulled: 0,
  lastPushed: 0,
  errors: [],
  setStatus: status => set({status}),
  setLastSyncAt: ts => set({lastSyncAt: ts}),
  setLastPulled: n => set({lastPulled: n}),
  setLastPushed: n => set({lastPushed: n}),
  pushError: msg => set(s => ({errors: [...s.errors, msg]})),
  clearErrors: () => set({errors: []}),
}));
