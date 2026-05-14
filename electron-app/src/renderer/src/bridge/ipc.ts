export interface CheckoutData {
  payment_mode: string
  amount_paid: number
  amount_tendered: number
  change_amount: number
  balance_due: number
  discount_amount: number
  grand_total: number
  taxable_amount: number
  cgst_total: number
  sgst_total: number
  split_payments?: Array<{ mode: string; amount: number; tendered?: number }>
  notes?: string
}

export interface LocalOrderSummary {
  id: string
  server_id: string | null
  order_type: string
  table_id: string | null
  table_name: string | null
  pax: number
  status: string
  pos_held: number
  grand_total: number
  discount_amount: number
  taxable_amount: number
  cgst_total: number
  sgst_total: number
  pos_payment_mode: string | null
  kot_count: number
  notes: string | null
  invoice_number: string | null
  sync_status: string
  created_at: string
  line_count: number
}

export interface LocalOrderFull extends LocalOrderSummary {
  amount_paid: number
  amount_tendered: number
  change_amount: number
  balance_due: number
  invoice_date: string | null
  lines: LocalOrderLine[]
}

export type LocalHeldOrder = LocalOrderSummary & { lines: LocalOrderLine[] }

export interface LocalOrderLine {
  id: string
  item_id: string
  item_name: string
  item_variant_id: string | null
  quantity: number
  rate: number
  discount_percent: number
  gst_rate: number
  notes: string | null
  kot_status: string
  unit: string
}

export interface LocalActiveOrder {
  id: string
  order_type: string
  lines: LocalOrderLine[]
}

export interface LocalKot {
  id: string
  server_id: string | null
  sales_invoice_id: string
  kot_number: string
  status: 'new' | 'in_progress' | 'ready' | 'served'
  notes: string | null
  print_count: number
  sync_status: string
  created_at: string
  lines: {
    id: string
    kot_id: string
    item_id: string
    item_name: string
    variant_name: string | null
    modifier_summary: string | null
    quantity: number
    notes: string | null
    status: 'pending' | 'cooking' | 'ready'
  }[]
}

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
        updateStatus(id: string, status: string, currentOrderId: string | null): Promise<void>
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
        findByTable(tableId: string): Promise<LocalActiveOrder | null>
        list(filters?: { status?: string; today?: boolean }): Promise<LocalOrderSummary[]>
        get(id: string): Promise<LocalOrderFull | null>
        listHeld(): Promise<LocalHeldOrder[]>
        hold(id: string): Promise<void>
        unhold(id: string): Promise<void>
        cancel(id: string): Promise<void>
        checkout(id: string, data: CheckoutData): Promise<{ success: boolean }>
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
      kots: {
        list(): Promise<LocalKot[]>
        updateStatus(id: string, status: string): Promise<void>
        updateLineStatus(kotId: string, lineId: string, status: string): Promise<void>
        upsertFromServer(kot: unknown): Promise<void>
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
    getAll:        () => window.electronAPI.tables.getAll(),
    getFloorPlans: () => window.electronAPI.tables.getFloorPlans(),
    updateStatus:  (id: string, status: string, currentOrderId: string | null) =>
      window.electronAPI.tables.updateStatus(id, status, currentOrderId),
  },
  order: {
    create:         (data: { order_type: string; table_id?: string | null; pax?: number }) => window.electronAPI.order.create(data),
    addLine:        (invoiceId: string, line: Parameters<Window['electronAPI']['order']['addLine']>[1]) => window.electronAPI.order.addLine(invoiceId, line),
    updateLineQty:  (lineId: string, qty: number) => window.electronAPI.order.updateLineQty(lineId, qty),
    removeLine:     (lineId: string) => window.electronAPI.order.removeLine(lineId),
    sendKot:        (localOrderId: string) => window.electronAPI.order.sendKot(localOrderId),
    markConfirmed:  (localId: string, serverId?: string | null) => window.electronAPI.order.markConfirmed(localId, serverId),
    findByTable:    (tableId: string) => window.electronAPI.order.findByTable(tableId),
    list:           (filters?: { status?: string; today?: boolean }) => window.electronAPI.order.list(filters),
    get:            (id: string) => window.electronAPI.order.get(id),
    listHeld:       () => window.electronAPI.order.listHeld(),
    hold:           (id: string) => window.electronAPI.order.hold(id),
    unhold:         (id: string) => window.electronAPI.order.unhold(id),
    cancel:         (id: string) => window.electronAPI.order.cancel(id),
    checkout:       (id: string, data: CheckoutData) => window.electronAPI.order.checkout(id, data),
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
  kots: {
    list:             () => window.electronAPI.kots.list(),
    updateStatus:     (id: string, status: string) => window.electronAPI.kots.updateStatus(id, status),
    updateLineStatus: (kotId: string, lineId: string, status: string) => window.electronAPI.kots.updateLineStatus(kotId, lineId, status),
    upsertFromServer: (kot: unknown) => window.electronAPI.kots.upsertFromServer(kot),
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
