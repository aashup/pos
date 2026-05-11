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
