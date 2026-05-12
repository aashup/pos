declare global {
  interface Window {
    electronAPI: {
      auth: {
        getToken(): Promise<string | null>
        setToken(token: string): Promise<void>
        clearToken(): Promise<void>
        getDeviceId(): Promise<string>
      }
      settings: {
        get(key: string): Promise<string | null>
        set(key: string, value: string): Promise<void>
        delete(key: string): Promise<void>
      }
      items: {
        search(query: string, groupId?: string): Promise<unknown[]>
        getGroups(): Promise<unknown[]>
        getAll(): Promise<unknown[]>
      }
      units: {
        getAll(): Promise<unknown[]>
      }
      tables: {
        getAll(): Promise<unknown[]>
        getFloorPlans(): Promise<unknown[]>
      }
      order: {
        create(data: { order_type: string; table_id?: string | null; pax?: number }): Promise<string>
        addLine(invoiceId: string, line: {
          id: string; item_id: string; item_name: string; quantity: number
          rate: number; discount_percent: number; gst_rate: number; notes?: string | null
        }): Promise<void>
        updateLineQty(lineId: string, qty: number): Promise<void>
        removeLine(lineId: string): Promise<void>
        sendKot(localOrderId: string): Promise<{ success: boolean; kotNumber?: string; lines?: unknown[]; error?: string }>
        markConfirmed(localId: string, serverId?: string | null): Promise<void>
      }
      sync: {
        trigger(): Promise<unknown>
        getStatus(): Promise<unknown>
        onStatusChange(cb: (status: unknown) => void): () => void
      }
      print: {
        receipt(data: unknown): Promise<{ success: boolean; error?: string }>
        kot(data: unknown): Promise<{ success: boolean; error?: string }>
        listPrinters(): Promise<string[]>
      }
      window: {
        openKitchen(): Promise<void>
        closeKitchen(): Promise<void>
      }
      updater: {
        installNow(): Promise<void>
        onUpdateAvailable(cb: (info: unknown) => void): () => void
        onUpdateDownloaded(cb: (info: unknown) => void): () => void
      }
    }
  }
}

export const ipc = {
  auth: {
    getToken:    () => window.electronAPI.auth.getToken(),
    setToken:    (t: string) => window.electronAPI.auth.setToken(t),
    clearToken:  () => window.electronAPI.auth.clearToken(),
    getDeviceId: () => window.electronAPI.auth.getDeviceId(),
  },
  settings: {
    get:    (key: string) => window.electronAPI.settings.get(key),
    set:    (key: string, value: string) => window.electronAPI.settings.set(key, value),
    delete: (key: string) => window.electronAPI.settings.delete(key),
  },
  items: {
    search:    (query: string, groupId?: string) => window.electronAPI.items.search(query, groupId),
    getGroups: () => window.electronAPI.items.getGroups(),
    getAll:    () => window.electronAPI.items.getAll(),
  },
  units: {
    getAll: () => window.electronAPI.units.getAll(),
  },
  tables: {
    getAll:       () => window.electronAPI.tables.getAll(),
    getFloorPlans: () => window.electronAPI.tables.getFloorPlans(),
  },
  order: {
    create:         (data: { order_type: string; table_id?: string | null; pax?: number }) => window.electronAPI.order.create(data),
    addLine:        (invoiceId: string, line: Parameters<Window['electronAPI']['order']['addLine']>[1]) => window.electronAPI.order.addLine(invoiceId, line),
    updateLineQty:  (lineId: string, qty: number) => window.electronAPI.order.updateLineQty(lineId, qty),
    removeLine:     (lineId: string) => window.electronAPI.order.removeLine(lineId),
    sendKot:        (localOrderId: string) => window.electronAPI.order.sendKot(localOrderId),
    markConfirmed:  (localId: string, serverId?: string | null) => window.electronAPI.order.markConfirmed(localId, serverId),
  },
  sync: {
    trigger:        () => window.electronAPI.sync.trigger(),
    getStatus:      () => window.electronAPI.sync.getStatus(),
    onStatusChange: (cb: (s: unknown) => void) => window.electronAPI.sync.onStatusChange(cb),
  },
  print: {
    receipt:      (data: unknown) => window.electronAPI.print.receipt(data),
    kot:          (data: unknown) => window.electronAPI.print.kot(data),
    listPrinters: () => window.electronAPI.print.listPrinters(),
  },
  window: {
    openKitchen:  () => window.electronAPI.window.openKitchen(),
    closeKitchen: () => window.electronAPI.window.closeKitchen(),
  },
  updater: {
    installNow:         () => window.electronAPI.updater.installNow(),
    onUpdateAvailable:  (cb: (info: unknown) => void) => window.electronAPI.updater.onUpdateAvailable(cb),
    onUpdateDownloaded: (cb: (info: unknown) => void) => window.electronAPI.updater.onUpdateDownloaded(cb),
  },
}
