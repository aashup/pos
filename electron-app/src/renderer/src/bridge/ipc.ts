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
      }
      tables: {
        getAll(): Promise<unknown[]>
        getFloorPlans(): Promise<unknown[]>
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
  },
  tables: {
    getAll:       () => window.electronAPI.tables.getAll(),
    getFloorPlans: () => window.electronAPI.tables.getFloorPlans(),
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
