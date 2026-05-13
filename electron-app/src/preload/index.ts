import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    getToken:    (): Promise<string | null> => ipcRenderer.invoke('auth:token:get'),
    setToken:    (token: string): Promise<void> => ipcRenderer.invoke('auth:token:set', token),
    clearToken:  (): Promise<void> => ipcRenderer.invoke('auth:token:clear'),
    getDeviceId: (): Promise<string> => ipcRenderer.invoke('auth:device-id'),
  },

  settings: {
    get:    (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
    set:    (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('settings:delete', key),
  },

  items: {
    search:    (query: string, groupId?: string): Promise<unknown[]> => ipcRenderer.invoke('items:search', query, groupId),
    getGroups: (): Promise<unknown[]> => ipcRenderer.invoke('items:groups'),
    getAll:    (): Promise<unknown[]> => ipcRenderer.invoke('items:get-all'),
  },

  units: {
    getAll: (): Promise<unknown[]> => ipcRenderer.invoke('units:get-all'),
  },

  tables: {
    getAll:       (): Promise<unknown[]> => ipcRenderer.invoke('tables:get-all'),
    getFloorPlans: (): Promise<unknown[]> => ipcRenderer.invoke('tables:floor-plans'),
  },

  order: {
    create: (data: { order_type: string; table_id?: string | null; pax?: number }): Promise<string> =>
      ipcRenderer.invoke('order:create', data),
    addLine: (invoiceId: string, line: {
      id: string; item_id: string; item_name: string; quantity: number
      rate: number; discount_percent: number; gst_rate: number; notes?: string | null
    }): Promise<void> => ipcRenderer.invoke('order:add-line', invoiceId, line),
    updateLineQty: (lineId: string, qty: number): Promise<void> =>
      ipcRenderer.invoke('order:update-line-qty', lineId, qty),
    removeLine: (lineId: string): Promise<void> =>
      ipcRenderer.invoke('order:remove-line', lineId),
    sendKot: (localOrderId: string): Promise<{ success: boolean; kotNumber?: string; lines?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('order:send-kot', localOrderId),
    markConfirmed: (localId: string, serverId?: string | null): Promise<void> =>
      ipcRenderer.invoke('order:mark-confirmed', localId, serverId),
    findByTable: (tableId: string): Promise<unknown> =>
      ipcRenderer.invoke('order:find-by-table', tableId),
  },

  sync: {
    trigger:      (): Promise<unknown> => ipcRenderer.invoke('sync:trigger'),
    getStatus:    (): Promise<unknown> => ipcRenderer.invoke('sync:status'),
    onStatusChange: (callback: (status: unknown) => void) => {
      ipcRenderer.on('sync:status-changed', (_, status) => callback(status))
      return () => ipcRenderer.removeAllListeners('sync:status-changed')
    },
  },

  print: {
    receipt:      (data: unknown): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('print:receipt', data),
    kot:          (data: unknown): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('print:kot', data),
    listPrinters: (): Promise<string[]> => ipcRenderer.invoke('print:list-printers'),
  },

  kots: {
    list:             (): Promise<unknown[]> => ipcRenderer.invoke('kots:list'),
    updateStatus:     (id: string, status: string): Promise<void> => ipcRenderer.invoke('kots:update-status', id, status),
    updateLineStatus: (kotId: string, lineId: string, status: string): Promise<void> => ipcRenderer.invoke('kots:update-line-status', kotId, lineId, status),
    upsertFromServer: (kot: unknown): Promise<void> => ipcRenderer.invoke('kots:upsert-from-server', kot),
  },

  window: {
    openKitchen:  (): Promise<void> => ipcRenderer.invoke('window:open-kitchen'),
    closeKitchen: (): Promise<void> => ipcRenderer.invoke('window:close-kitchen'),
  },

  updater: {
    installNow: (): Promise<void> => ipcRenderer.invoke('updater:install-now'),
    onUpdateAvailable: (cb: (info: unknown) => void) => {
      ipcRenderer.on('updater:update-available', (_, info) => cb(info))
      return () => ipcRenderer.removeAllListeners('updater:update-available')
    },
    onUpdateDownloaded: (cb: (info: unknown) => void) => {
      ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info))
      return () => ipcRenderer.removeAllListeners('updater:update-downloaded')
    },
  },
})
