/**
 * SyncWorker — runs in a worker_thread, never on the main thread.
 * Opens its own better-sqlite3 connection so main-thread reads are never blocked.
 * Receives: { dbPath, token, serverUrl } via workerData.
 * Posts back: { pushed, pulled, errors } when done.
 */
import { workerData, parentPort } from 'worker_threads'
import Database from 'better-sqlite3'
import axios from 'axios'

interface WorkerData {
  dbPath: string
  token: string
  serverUrl: string
}

const { dbPath, token, serverUrl } = workerData as WorkerData

async function run() {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  const client = axios.create({
    baseURL: `${serverUrl}/api/v1`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000,
  })

  let pulled = 0
  let pushed = 0
  const errors: string[] = []

  // ── PUSH: local pending invoices → server ──────────────────────────────────
  try {
    const pendingInvoices = db
      .prepare(`SELECT * FROM sales_invoices WHERE sync_status = 'pending' AND status = 'confirmed' LIMIT 50`)
      .all() as Record<string, any>[]

    for (const invoice of pendingInvoices) {
      try {
        const lines = db
          .prepare('SELECT * FROM sales_invoice_lines WHERE sales_invoice_id = ?')
          .all(invoice.id) as Record<string, any>[]

        await client.post('/restaurant/orders', {
          order_type: invoice.order_type,
          table_id: invoice.table_id,
          pax: invoice.pax,
          invoice_date: invoice.invoice_date,
          pos_payment_mode: invoice.pos_payment_mode,
          grand_total: invoice.grand_total,
          notes: invoice.notes,
          lines: lines.map((l) => ({
            item_id: l.item_id,
            quantity: l.quantity,
            rate: l.rate,
            discount_percent: l.discount_percent,
            gst_rate: l.gst_rate,
            notes: l.notes,
          })),
        })

        db.prepare(`UPDATE sales_invoices SET sync_status = 'synced', synced_at = datetime('now') WHERE id = ?`).run(invoice.id)
        pushed++
      } catch (e: unknown) {
        errors.push(`invoice ${invoice.id}: ${(e as Error).message}`)
        db.prepare(`UPDATE sales_invoices SET sync_status = 'failed' WHERE id = ?`).run(invoice.id)
      }
    }
  } catch (e: unknown) {
    errors.push(`push: ${(e as Error).message}`)
  }

  // ── PULL: server → local SQLite ────────────────────────────────────────────

  // Units
  try {
    const res = await client.get('/units?per_page=500&status=active')
    const rows: any[] = res.data?.data ?? res.data ?? []
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO units (id, company_id, value, label, status, synced_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    db.transaction((items: any[]) => {
      for (const u of items) { stmt.run(u.id, u.company_id ?? null, u.value, u.label, u.status ?? 'active'); pulled++ }
    })(rows)
  } catch (e: unknown) { errors.push(`units: ${(e as Error).message}`) }

  // Item groups
  try {
    const res = await client.get('/item-groups?per_page=500')
    const rows: any[] = res.data?.data ?? res.data ?? []
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO item_groups (id, company_id, parent_id, name, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    db.transaction((items: any[]) => {
      for (const g of items) { stmt.run(g.id, g.company_id, g.parent_id ?? null, g.name, g.is_active ? 1 : 0); pulled++ }
    })(rows)
  } catch (e: unknown) { errors.push(`item-groups: ${(e as Error).message}`) }

  // Items (paginated)
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO items
         (id, company_id, item_group_id, name, sku, selling_price, cgst, sgst, igst, unit, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/items?per_page=200&page=${page}&is_active=true`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const item of items) {
          stmt.run(
            item.id, item.company_id ?? null, item.item_group_id ?? null,
            item.name, item.sku ?? null,
            Number(item.selling_price ?? 0), Number(item.cgst ?? 0),
            Number(item.sgst ?? 0), Number(item.igst ?? 0),
            item.unit ?? null, item.is_active ? 1 : 0,
          )
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`items: ${(e as Error).message}`) }

  // Item media (paginated) — uses /media/sync which allows bulk fetch by entity_type
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO media (id, company_id, entity_type, entity_id, url, sort_order, is_primary, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/media/sync?entity_type=item&per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const m of items) {
          stmt.run(m.id, m.company_id ?? null, m.entity_type, m.entity_id, m.url, m.sort_order ?? 0, m.is_primary ? 1 : 0)
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`media: ${(e as Error).message}`) }

  // Floor plans
  try {
    const res = await client.get('/floor-plans')
    const rows: any[] = res.data?.data ?? []
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO floor_plans (id, company_id, name, sort_order, synced_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    db.transaction((items: any[]) => {
      for (const fp of items) { stmt.run(fp.id, fp.company_id, fp.name, fp.sort_order ?? 0); pulled++ }
    })(rows)
  } catch (e: unknown) { errors.push(`floor-plans: ${(e as Error).message}`) }

  // Dining tables
  try {
    const res = await client.get('/dining-tables?is_active=1')
    const rows: any[] = res.data?.data ?? []
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO dining_tables
         (id, company_id, floor_plan_id, name, capacity, shape, pos_x, pos_y, status, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    db.transaction((items: any[]) => {
      for (const t of items) {
        stmt.run(t.id, t.company_id, t.floor_plan_id, t.name, t.capacity ?? 4,
          t.shape ?? 'square', t.pos_x ?? 0, t.pos_y ?? 0,
          t.status ?? 'vacant', t.is_active ? 1 : 0)
        pulled++
      }
    })(rows)
  } catch (e: unknown) { errors.push(`dining-tables: ${(e as Error).message}`) }

  // Godowns
  try {
    const res = await client.get('/godowns')
    const rows: any[] = res.data?.data ?? []
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO godowns (id, company_id, name, is_default, synced_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    db.transaction((items: any[]) => {
      for (const g of items) { stmt.run(g.id, g.company_id, g.name, g.is_default ? 1 : 0); pulled++ }
    })(rows)
  } catch (e: unknown) { errors.push(`godowns: ${(e as Error).message}`) }

  db.close()
  parentPort?.postMessage({ pulled, pushed, errors })
}

run().catch((err) => {
  parentPort?.postMessage({ pulled: 0, pushed: 0, errors: [`worker crash: ${err.message}`] })
})
