export type TemplateType = 'kot' | 'invoice'

export interface SalesSummaryResult {
  total_orders: number
  total_revenue: number
  total_tax: number
  total_discount: number
  avg_order_value: number
  by_order_type: { order_type: string; count: number; revenue: number }[]
  by_payment_mode: { payment_mode: string; count: number; amount: number }[]
  daily: { date: string; count: number; revenue: number }[]
}

export interface ItemWiseRow {
  item_id: string
  item_name: string
  total_quantity: number
  total_revenue: number
  taxable_amount: number
  tax_amount: number
  order_count: number
}

export interface DayCloseResult {
  date: string
  total_cash: number
  total_upi: number
  total_card: number
  total_credit: number
  total_revenue: number
  total_orders: number
  total_tax: number
  total_discount: number
  cancelled_orders: number
  top_items: { name: string; quantity: number; revenue: number }[]
}

export interface GSTResult {
  date_from: string
  date_to: string
  by_rate: {
    gst_rate: number
    taxable_amount: number
    cgst_total: number
    sgst_total: number
    igst_total: number
    total_tax: number
  }[]
  total_taxable: number
  total_cgst: number
  total_sgst: number
  total_igst: number
}

export interface POSCombo {
  id: string
  company_id: string
  name: string
  description: string | null
  price: number
  cgst: number
  sgst: number
  igst: number
  sort_order: number
  is_active: number
  image_url: string | null
}

export interface LocalPrintTemplate {
  id: string
  type: TemplateType
  name: string
  layout: string
  is_active: number
  server_id: string | null
  sync_status: string
  updated_at: string | null
  created_at: string
}

export interface LocalCustomer {
  id: string
  server_id: string | null
  name: string
  phone: string | null
  type: string
  sync_status: string
  created_at: string
}

export interface POSItemVariant {
  id: string
  item_id: string
  name: string
  price_override: number | null
  sku: string | null
  sort_order: number
  is_active: boolean
}

export interface POSModifier {
  id: string
  modifier_group_id: string
  name: string
  price: number
  sort_order: number
  is_active: boolean
}

export interface POSModifierGroup {
  id: string
  company_id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  is_active: boolean
  modifiers: POSModifier[]
}

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
  computed_total: number
  pending_line_count: number
  latest_kot_status: string | null
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
  table_name: string | null
  order_type: string
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
        getAllInventory(): Promise<unknown[]>
        getVariants(itemId: string): Promise<unknown[]>
        getModifierGroups(itemId: string): Promise<unknown[]>
      }
      combos: {
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
          item_variant_id?: string | null; combo_id?: string | null; modifiers_total?: number
        }): Promise<void>
        updateLineNotes(lineId: string, notes: string | null): Promise<void>
        updateNotes(id: string, notes: string | null): Promise<void>
        updateLineQty(lineId: string, qty: number): Promise<void>
        removeLine(lineId: string): Promise<void>
        sendKot(localOrderId: string): Promise<{ success: boolean; kotNumber?: string; lines?: unknown[]; error?: string }>
        markConfirmed(localId: string, serverId?: string | null): Promise<void>
        findByTable(tableId: string): Promise<LocalActiveOrder | null>
        findByServerId(serverId: string): Promise<{ id: string; order_type: string } | null>
        list(filters?: { status?: string; today?: boolean }): Promise<LocalOrderSummary[]>
        get(id: string): Promise<LocalOrderFull | null>
        listHeld(): Promise<LocalHeldOrder[]>
        hold(id: string): Promise<void>
        unhold(id: string): Promise<void>
        cancel(id: string): Promise<void>
        checkout(id: string, data: CheckoutData): Promise<{ success: boolean }>
      }
      customer: {
        search(query: string): Promise<LocalCustomer[]>
        create(name: string, phone?: string): Promise<LocalCustomer>
      }
      reports: {
        salesSummary(dateFrom: string, dateTo: string): Promise<SalesSummaryResult>
        itemWise(dateFrom: string, dateTo: string): Promise<ItemWiseRow[]>
        dayClose(date: string): Promise<DayCloseResult>
        gstSummary(dateFrom: string, dateTo: string): Promise<GSTResult>
      }
      sync: {
        trigger(): Promise<unknown>
        getStatus(): Promise<unknown>
        onStatusChange(cb: (status: unknown) => void): () => void
      }
      print: {
        receipt(data: unknown): Promise<{ success: boolean; error?: string }>
        kot(data: unknown): Promise<{ success: boolean; error?: string }>
        kotFromTemplate(data: unknown, layout: string): Promise<{ success: boolean; error?: string }>
        htmlInvoice(html: string, silent?: boolean): Promise<{ success: boolean; error?: string }>
        htmlKot(html: string, silent?: boolean): Promise<{ success: boolean; error?: string }>
        listPrinters(): Promise<string[]>
      }
      templates: {
        list(): Promise<LocalPrintTemplate[]>
        getActive(type: TemplateType): Promise<LocalPrintTemplate | null>
        upsert(template: LocalPrintTemplate): Promise<void>
        bulkUpsert(templates: LocalPrintTemplate[]): Promise<void>
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
        toggleFullscreen(): Promise<void>
        isFullscreen(): Promise<boolean>
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
  combos: {
    getAll: async (): Promise<POSCombo[]> => {
      const rows = await window.electronAPI.combos.getAll() as POSCombo[]
      return rows.map((r) => ({ ...r, is_active: Number(r.is_active) }))
    },
  },
  items: {
    search:    (query: string, groupId?: string) => window.electronAPI.items.search(query, groupId),
    getGroups: () => window.electronAPI.items.getGroups(),
    getAll:    () => window.electronAPI.items.getAll(),
    getAllInventory: () => window.electronAPI.items.getAllInventory(),
    getVariants: async (itemId: string): Promise<POSItemVariant[]> => {
      const rows = await window.electronAPI.items.getVariants(itemId) as any[]
      return rows.map((r) => ({ ...r, is_active: !!r.is_active }))
    },
    getModifierGroups: async (itemId: string): Promise<POSModifierGroup[]> => {
      const rows = await window.electronAPI.items.getModifierGroups(itemId) as any[]
      return rows.map((g) => ({
        ...g,
        is_required: !!g.is_required,
        is_active: !!g.is_active,
        modifiers: (g.modifiers ?? []).map((m: any) => ({ ...m, is_active: !!m.is_active })),
      }))
    },
  },
  units: {
    getAll: () => window.electronAPI.units.getAll(),
  },
  customer: {
    search: async (query: string): Promise<LocalCustomer[]> => {
      const rows = await window.electronAPI.customer.search(query) as LocalCustomer[]
      return rows
    },
    create: async (name: string, phone?: string): Promise<LocalCustomer> => {
      return window.electronAPI.customer.create(name, phone) as Promise<LocalCustomer>
    },
  },
  tables: {
    getAll:        () => window.electronAPI.tables.getAll(),
    getFloorPlans: () => window.electronAPI.tables.getFloorPlans(),
    updateStatus:  (id: string, status: string, currentOrderId: string | null) =>
      window.electronAPI.tables.updateStatus(id, status, currentOrderId),
  },
  order: {
    create:         (data: { order_type: string; table_id?: string | null; pax?: number }) => window.electronAPI.order.create(data),
    addLine: (invoiceId: string, line: Parameters<Window['electronAPI']['order']['addLine']>[1]) => window.electronAPI.order.addLine(invoiceId, line),
    updateLineNotes: (lineId: string, notes: string | null) => window.electronAPI.order.updateLineNotes(lineId, notes),
    updateNotes: (id: string, notes: string | null) => window.electronAPI.order.updateNotes(id, notes),
    updateLineQty:  (lineId: string, qty: number) => window.electronAPI.order.updateLineQty(lineId, qty),
    removeLine:     (lineId: string) => window.electronAPI.order.removeLine(lineId),
    sendKot:        (localOrderId: string) => window.electronAPI.order.sendKot(localOrderId),
    markConfirmed:  (localId: string, serverId?: string | null) => window.electronAPI.order.markConfirmed(localId, serverId),
    findByTable:    (tableId: string) => window.electronAPI.order.findByTable(tableId),
    findByServerId: (serverId: string) => window.electronAPI.order.findByServerId(serverId),
    list:           (filters?: { status?: string; today?: boolean }) => window.electronAPI.order.list(filters),
    get:            (id: string) => window.electronAPI.order.get(id),
    listHeld:       () => window.electronAPI.order.listHeld(),
    hold:           (id: string) => window.electronAPI.order.hold(id),
    unhold:         (id: string) => window.electronAPI.order.unhold(id),
    cancel:         (id: string) => window.electronAPI.order.cancel(id),
    checkout:       (id: string, data: CheckoutData) => window.electronAPI.order.checkout(id, data),
  },
  reports: {
    salesSummary: (dateFrom: string, dateTo: string): Promise<SalesSummaryResult> =>
      window.electronAPI.reports.salesSummary(dateFrom, dateTo) as Promise<SalesSummaryResult>,
    itemWise: (dateFrom: string, dateTo: string): Promise<ItemWiseRow[]> =>
      window.electronAPI.reports.itemWise(dateFrom, dateTo) as Promise<ItemWiseRow[]>,
    dayClose: (date: string): Promise<DayCloseResult> =>
      window.electronAPI.reports.dayClose(date) as Promise<DayCloseResult>,
    gstSummary: (dateFrom: string, dateTo: string): Promise<GSTResult> =>
      window.electronAPI.reports.gstSummary(dateFrom, dateTo) as Promise<GSTResult>,
  },
  sync: {
    trigger:        () => window.electronAPI.sync.trigger(),
    getStatus:      () => window.electronAPI.sync.getStatus(),
    onStatusChange: (cb: (s: unknown) => void) => window.electronAPI.sync.onStatusChange(cb),
  },
  print: {
    receipt:         (data: unknown) => window.electronAPI.print.receipt(data),
    kot:             (data: unknown) => window.electronAPI.print.kot(data),
    kotFromTemplate: (data: unknown, layout: string) => window.electronAPI.print.kotFromTemplate(data, layout),
    htmlInvoice:     (html: string, silent?: boolean) => window.electronAPI.print.htmlInvoice(html, silent),
    htmlKot:         (html: string, silent?: boolean) => window.electronAPI.print.htmlKot(html, silent),
    listPrinters:    () => window.electronAPI.print.listPrinters(),
  },
  templates: {
    list:       () => window.electronAPI.templates.list(),
    getActive:  (type: TemplateType) => window.electronAPI.templates.getActive(type),
    upsert:     (template: LocalPrintTemplate) => window.electronAPI.templates.upsert(template),
    bulkUpsert: (templates: LocalPrintTemplate[]) => window.electronAPI.templates.bulkUpsert(templates),
  },
  kots: {
    list:             () => window.electronAPI.kots.list(),
    updateStatus:     (id: string, status: string) => window.electronAPI.kots.updateStatus(id, status),
    updateLineStatus: (kotId: string, lineId: string, status: string) => window.electronAPI.kots.updateLineStatus(kotId, lineId, status),
    upsertFromServer: (kot: unknown) => window.electronAPI.kots.upsertFromServer(kot),
    onStatusChange:   (cb: (data: { id: string; status: string }) => void) =>
      window.electronAPI.kots.onStatusChange(cb as (data: unknown) => void),
  },
  window: {
    openKitchen:      () => window.electronAPI.window.openKitchen(),
    closeKitchen:     () => window.electronAPI.window.closeKitchen(),
    toggleFullscreen: () => window.electronAPI.window.toggleFullscreen(),
    isFullscreen:     () => window.electronAPI.window.isFullscreen(),
  },
  updater: {
    installNow:         () => window.electronAPI.updater.installNow(),
    onUpdateAvailable:  (cb: (info: unknown) => void) => window.electronAPI.updater.onUpdateAvailable(cb),
    onUpdateDownloaded: (cb: (info: unknown) => void) => window.electronAPI.updater.onUpdateDownloaded(cb),
  },
}
