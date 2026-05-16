import { ipcMain, webContents } from 'electron'
import axios from 'axios'
import { TokenStore } from '../auth/TokenStore'
import { ItemRepository } from '../db/repositories/ItemRepository'
import { TableRepository } from '../db/repositories/TableRepository'
import { UnitRepository } from '../db/repositories/UnitRepository'
import { OrderRepository, type CheckoutData } from '../db/repositories/OrderRepository'
import { KotRepository } from '../db/repositories/KotRepository'
import { CustomerRepository } from '../db/repositories/CustomerRepository'
import { runSync, getSyncStatus } from '../sync/SyncEngine'
import { printReceipt, printKOT, printKotFromTemplate, type ReceiptData, type KOTData } from '../print/ThermalPrinter'
import { printHtmlInvoice, printHtmlKot } from '../print/HtmlInvoicePrinter'
import { PrintTemplateRepository } from '../db/repositories/PrintTemplateRepository'
import type { LocalPrintTemplate } from '../db/repositories/PrintTemplateRepository'

export function registerIpcHandlers(): void {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:token:get', () => TokenStore.getToken())
  ipcMain.handle('auth:token:set', (_, token: string) => TokenStore.setToken(token))
  ipcMain.handle('auth:token:clear', () => TokenStore.clearToken())
  ipcMain.handle('auth:device-id', () => TokenStore.getDeviceId())

  // ── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key: string) => TokenStore.getSetting(key))
  ipcMain.handle('settings:set', (_, key: string, value: string) => TokenStore.setSetting(key, value))
  ipcMain.handle('settings:delete', (_, key: string) => TokenStore.deleteSetting(key))

  // ── Items ─────────────────────────────────────────────────────────────────
  ipcMain.handle('items:search', (_, query: string, groupId?: string) =>
    ItemRepository.search(query, groupId),
  )
  ipcMain.handle('items:groups', () => ItemRepository.getGroups())
  ipcMain.handle('items:get-all', () => ItemRepository.getAllForPOS())
  ipcMain.handle('items:get-variants', (_, itemId: string) =>
    ItemRepository.getVariants(itemId),
  )
  ipcMain.handle('items:get-modifier-groups', (_, itemId: string) =>
    ItemRepository.getModifierGroupsForItem(itemId),
  )

  // ── Units ─────────────────────────────────────────────────────────────────
  ipcMain.handle('units:get-all', () => UnitRepository.getAll())

  // ── Tables ────────────────────────────────────────────────────────────────
  ipcMain.handle('tables:get-all', () => TableRepository.getAll())
  ipcMain.handle('tables:floor-plans', () => TableRepository.getFloorPlans())
  ipcMain.handle('tables:update-status',
    (_, id: string, status: string, currentOrderId: string | null) =>
      TableRepository.updateStatus(id, status, currentOrderId),
  )

  // ── Orders (offline-first) ────────────────────────────────────────────────
  ipcMain.handle('order:create', (_, data: { order_type: string; table_id?: string | null; pax?: number }) =>
    OrderRepository.createOrder(data),
  )

  ipcMain.handle('order:add-line', (_, invoiceId: string, line: {
    id: string; item_id: string; item_name: string; quantity: number
    rate: number; discount_percent: number; gst_rate: number; notes?: string | null
    item_variant_id?: string | null; modifiers_total?: number
  }) => OrderRepository.addLine(invoiceId, line))

  ipcMain.handle('order:update-line-notes', (_, lineId: string, notes: string | null) =>
    OrderRepository.updateLineNotes(lineId, notes),
  )

  ipcMain.handle('order:update-notes', (_, id: string, notes: string | null) =>
    OrderRepository.updateNotes(id, notes),
  )

  ipcMain.handle('order:update-line-qty', (_, lineId: string, qty: number) =>
    OrderRepository.updateLineQty(lineId, qty),
  )

  ipcMain.handle('order:remove-line', (_, lineId: string) =>
    OrderRepository.removeLine(lineId),
  )

  ipcMain.handle('order:mark-confirmed', (_, localId: string, serverId?: string | null) =>
    OrderRepository.markConfirmed(localId, serverId),
  )

  ipcMain.handle('order:find-by-table', (_, tableId: string) =>
    OrderRepository.findActiveByTableId(tableId),
  )

  /**
   * Create a local KOT, print it immediately, then fire-and-forget push to server.
   * Returns { kotNumber, lines } — the renderer marks Zustand lines as 'sent'.
   */
  ipcMain.handle('order:send-kot', async (_, localOrderId: string) => {
    const kot = OrderRepository.createKot(localOrderId)
    if (!kot) return { success: false, error: 'No pending items' }

    // Background push to server (fire-and-forget — SyncWorker retries on failure)
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 15000,
          })

          const order = OrderRepository.getOrder(localOrderId)
          if (!order) return

          // 1. Ensure server order exists
          let serverId: string = order.server_id
          if (!serverId) {
            const res = await client.post('/restaurant/orders', {
              order_type: order.order_type,
              table_id: order.table_id ?? undefined,
              pax: order.pax ?? 1,
            })
            serverId = res.data?.data?.id
            OrderRepository.setServerId(localOrderId, serverId)
          }

          // 2. Push unsynced lines
          const unsynced = OrderRepository.getPendingLines(localOrderId)
          if (unsynced.length > 0) {
            await client.post(`/restaurant/orders/${serverId}/lines`, {
              lines: unsynced.map((l) => ({
                item_id: l.item_id,
                quantity: l.quantity,
                rate: l.rate,
                discount_percent: l.discount_percent ?? 0,
                gst_rate: l.gst_rate ?? 0,
                notes: l.notes ?? undefined,
              })),
            })
            OrderRepository.markLinesSynced(localOrderId)
          }

          // 3. Generate KOT on server and record its server UUID locally
          const kotRes = await client.post(`/restaurant/orders/${serverId}/kot`)
          const serverKotId: string | undefined = kotRes.data?.data?.id
          if (serverKotId) {
            KotRepository.setServerId(kot.id, serverKotId)
          }
        } catch {
          // Silent — SyncWorker will retry
        }
      })
    }

    return { success: true, kotNumber: kot.kot_number, lines: kot.lines }
  })

  // ── Orders: read + mutation channels ─────────────────────────────────────
  ipcMain.handle('order:list', (_, filters?: { status?: string; today?: boolean }) =>
    OrderRepository.list(filters),
  )

  ipcMain.handle('order:get', (_, id: string) =>
    OrderRepository.getById(id),
  )

  ipcMain.handle('order:list-held', () =>
    OrderRepository.listHeld(),
  )

  ipcMain.handle('order:hold', (_, id: string) => {
    OrderRepository.hold(id)
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const order = OrderRepository.getOrder(id)
          if (!order?.server_id) return
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          await client.post(`/restaurant/orders/${order.server_id}/hold`)
        } catch { /* silent — local hold already written */ }
      })
    }
  })

  ipcMain.handle('order:unhold', (_, id: string) => {
    OrderRepository.unhold(id)
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const order = OrderRepository.getOrder(id)
          if (!order?.server_id) return
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          await client.post(`/restaurant/orders/${order.server_id}/unhold`)
        } catch { /* silent */ }
      })
    }
  })

  ipcMain.handle('order:cancel', (_, id: string) => {
    OrderRepository.cancel(id)
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const order = OrderRepository.getOrder(id)
          if (!order?.server_id) return
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          await client.post(`/restaurant/orders/${order.server_id}/cancel`)
        } catch { /* silent */ }
      })
    }
  })

  ipcMain.handle('order:checkout', (_, localOrderId: string, data: CheckoutData) => {
    // 1. Write to SQLite immediately — works offline
    OrderRepository.checkout(localOrderId, data)

    // 2. Fire-and-forget push to server
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 15000,
          })

          const order = OrderRepository.getOrder(localOrderId)
          if (!order) return

          // Ensure server order exists
          let serverId: string = order.server_id
          if (!serverId) {
            const res = await client.post('/restaurant/orders', {
              order_type: order.order_type,
              table_id: order.table_id ?? undefined,
              pax: order.pax ?? 1,
            })
            serverId = res.data?.data?.id
            OrderRepository.setServerId(localOrderId, serverId)
          }

          // Push any unsynced lines
          const unsynced = OrderRepository.getPendingLines(localOrderId)
          if (unsynced.length > 0) {
            await client.post(`/restaurant/orders/${serverId}/lines`, {
              lines: unsynced.map((l) => ({
                item_id: l.item_id,
                quantity: l.quantity,
                rate: l.rate,
                discount_percent: l.discount_percent ?? 0,
                gst_rate: l.gst_rate ?? 0,
                notes: l.notes ?? undefined,
              })),
            })
            OrderRepository.markLinesSynced(localOrderId)
          }

          // Call checkout on server
          const payload = data.payment_mode === 'split'
            ? {
                payment_mode: 'split',
                discount_amount: data.discount_amount > 0 ? data.discount_amount : undefined,
                notes: data.notes || undefined,
                split_payments: data.split_payments,
              }
            : {
                payment_mode: data.payment_mode,
                amount_tendered: data.amount_tendered,
                discount_amount: data.discount_amount > 0 ? data.discount_amount : undefined,
                notes: data.notes || undefined,
              }
          await client.post(`/restaurant/orders/${serverId}/checkout`, payload)
          OrderRepository.markConfirmed(localOrderId, serverId)
        } catch { /* silent — SyncWorker will retry */ }
      })
    }

    return { success: true }
  })

  // ── KOTs (kitchen display — offline-first) ───────────────────────────────
  ipcMain.handle('kots:list', () => KotRepository.listActive())

  ipcMain.handle('kots:update-status', (_, id: string, status: string) => {
    // 1. Write to SQLite immediately (works offline)
    KotRepository.updateStatus(id, status)

    // 2. Notify all windows (main window needs to refresh KOT badges on table cards)
    webContents.getAllWebContents().forEach((wc) => wc.send('kots:status-changed', { id, status }))

    // 3. Background push to server — fire-and-forget, stays pending on failure
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const serverId = KotRepository.getServerId(id)
          if (!serverId) return  // not yet on server — next pull will reconcile
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          await client.patch(`/kots/${serverId}/status`, { status })
          KotRepository.markSynced(id)
        } catch {
          // Stays sync_status='pending' — background API pull will reconcile
        }
      })
    }
  })

  ipcMain.handle('kots:update-line-status', (_, kotId: string, lineId: string, status: string) => {
    // 1. Write to SQLite immediately (works offline)
    KotRepository.updateLineStatus(kotId, lineId, status)

    // 2. Background push — only possible when KOT has a server_id and
    //    line IDs from server-synced KOTs ARE server UUIDs
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const serverId = KotRepository.getServerId(kotId)
          if (!serverId) return  // locally-created KOT not yet on server
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          await client.patch(`/kots/${serverId}/lines/${lineId}/status`, { status })
        } catch {
          // Silent — KOT status will still auto-advance on next pull
        }
      })
    }
  })

  ipcMain.handle('kots:upsert-from-server', (_, kot: unknown) =>
    KotRepository.upsertFromServer(kot as Parameters<typeof KotRepository.upsertFromServer>[0]),
  )

  // ── Customers (offline-first, local SQLite) ───────────────────────────────
  ipcMain.handle('customer:search', (_, query: string) =>
    CustomerRepository.search(query),
  )

  ipcMain.handle('customer:create', (_, name: string, phone?: string) => {
    const customer = CustomerRepository.create(name, phone)

    // Fire-and-forget push to server — stays 'pending' if offline, SyncWorker retries
    const token = TokenStore.getToken()
    const serverUrl = TokenStore.getSetting('serverUrl')
    if (token && serverUrl) {
      setImmediate(async () => {
        try {
          const client = axios.create({
            baseURL: `${serverUrl}/api/v1`,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            timeout: 10000,
          })
          const res = await client.post('/parties', {
            type: 'customer',
            name: customer.name,
            phone: customer.phone ?? undefined,
          })
          const serverId: string | undefined = res.data?.data?.id
          if (serverId) CustomerRepository.markSynced(customer.id, serverId)
        } catch {
          // Stays sync_status='pending' — SyncWorker PUSH will retry on next cycle
        }
      })
    }

    return customer
  })

  // ── Sync ──────────────────────────────────────────────────────────────────
  ipcMain.handle('sync:trigger', () => runSync())
  ipcMain.handle('sync:status', () => getSyncStatus())

  // ── Print ─────────────────────────────────────────────────────────────────
  ipcMain.handle('print:receipt', (_, data: ReceiptData) => printReceipt(data))
  ipcMain.handle('print:kot', (_, data: KOTData) => printKOT(data))
  ipcMain.handle('print:kot-from-template', (_, data: KOTData, layout: string) =>
    printKotFromTemplate(data, layout),
  )
  ipcMain.handle('print:html-invoice', (_, html: string, silent?: boolean) => printHtmlInvoice(html, silent ?? true))
  ipcMain.handle('print:html-kot', (_, html: string, silent?: boolean) => printHtmlKot(html, silent ?? true))

  // List printers via renderer's webContents (which has access to OS printers)
  ipcMain.handle('print:list-printers', async (event) => {
    try {
      const wc = event.sender
      const printers = await wc.getPrintersAsync()
      return printers.map((p) => p.name)
    } catch {
      return []
    }
  })

  // ── Print Templates ───────────────────────────────────────────────────────
  ipcMain.handle('templates:list', () => PrintTemplateRepository.getAll())
  ipcMain.handle('templates:get-active', (_, type: 'kot' | 'invoice') =>
    PrintTemplateRepository.getActiveByType(type),
  )
  ipcMain.handle('templates:upsert', (_, template: LocalPrintTemplate) =>
    PrintTemplateRepository.upsert(template),
  )
  ipcMain.handle('templates:bulk-upsert', (_, templates: LocalPrintTemplate[]) =>
    PrintTemplateRepository.bulkUpsert(templates),
  )
}
