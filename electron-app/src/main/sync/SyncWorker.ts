/**
 * SyncWorker — runs in a worker_thread, never on the main thread.
 * Opens its own better-sqlite3 connection so main-thread reads are never blocked.
 * Receives: { dbPath, token, serverUrl } via workerData.
 * Posts back: { pushed, pulled, errors } when done.
 */
import { workerData, parentPort } from 'worker_threads'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs'
import { join, dirname, extname } from 'path'
import { pipeline } from 'stream/promises'
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

  const mediaCacheDir = join(dirname(dbPath), 'media-cache')
  mkdirSync(mediaCacheDir, { recursive: true })

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

  // ── PUSH: pending local customers → server ────────────────────────────────
  try {
    const pending = db
      .prepare(`SELECT id, name, phone, type FROM pos_customers WHERE sync_status = 'pending' LIMIT 50`)
      .all() as { id: string; name: string; phone: string | null; type: string }[]

    for (const c of pending) {
      try {
        const res = await client.post('/parties', {
          type: c.type ?? 'customer',
          name: c.name,
          phone: c.phone ?? undefined,
        })
        const serverId: string | undefined = res.data?.data?.id
        if (serverId) {
          db.prepare(
            `UPDATE pos_customers SET server_id = ?, sync_status = 'synced' WHERE id = ?`,
          ).run(serverId, c.id)
        }
        pushed++
      } catch (e: unknown) {
        errors.push(`customer ${c.id}: ${(e as Error).message}`)
        db.prepare(`UPDATE pos_customers SET sync_status = 'failed' WHERE id = ?`).run(c.id)
      }
    }
  } catch (e: unknown) {
    errors.push(`push-customers: ${(e as Error).message}`)
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

  // Item variants (paginated)
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO item_variants
         (id, item_id, name, price_override, sku, sort_order, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/item-variants?per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const v of items) {
          stmt.run(
            v.id, v.item_id, v.name,
            v.price_override != null ? Number(v.price_override) : null,
            v.sku ?? null, v.sort_order ?? 0, v.is_active ? 1 : 0,
          )
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`item-variants: ${(e as Error).message}`) }

  // Modifier groups
  try {
    const groupStmt = db.prepare(
      `INSERT OR REPLACE INTO modifier_groups
         (id, company_id, name, is_required, min_selections, max_selections, sort_order, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    const modStmt = db.prepare(
      `INSERT OR REPLACE INTO modifiers
         (id, modifier_group_id, name, price, sort_order, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/modifier-groups?per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const g of items) {
          groupStmt.run(
            g.id, g.company_id ?? null, g.name,
            g.is_required ? 1 : 0, g.min_selections ?? 0, g.max_selections ?? 1,
            g.sort_order ?? 0, g.is_active ? 1 : 0,
          )
          pulled++
          // Sync embedded modifiers if API returns them
          if (Array.isArray(g.modifiers)) {
            for (const m of g.modifiers) {
              modStmt.run(
                m.id, g.id, m.name, Number(m.price ?? 0),
                m.sort_order ?? 0, m.is_active ? 1 : 0,
              )
              pulled++
            }
          }
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`modifier-groups: ${(e as Error).message}`) }

  // Item → modifier group links
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO item_modifier_groups
         (id, item_id, modifier_group_id, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/item-modifier-groups?per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const link of items) {
          stmt.run(link.id, link.item_id, link.modifier_group_id, link.sort_order ?? 0)
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`item-modifier-groups: ${(e as Error).message}`) }

  // Item media (paginated) — uses /media/sync which allows bulk fetch by entity_type
  // Three-phase: (A) upsert metadata, (B) purge deleted, (C) download image files
  try {
    // Phase A — metadata upsert using INSERT OR IGNORE + UPDATE to preserve local_path
    // INSERT OR REPLACE would delete+reinsert the row, wiping local_path on every sync.
    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO media (id, company_id, entity_type, entity_id, url, sort_order, is_primary, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    const updateMetaStmt = db.prepare(
      `UPDATE media SET company_id=?, entity_type=?, entity_id=?, url=?, sort_order=?, is_primary=?, synced_at=datetime('now')
       WHERE id=?`,
    )
    const serverIds = new Set<string>()
    let page = 1
    while (true) {
      const res = await client.get(`/media/sync?entity_type=item&per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const m of items) {
          serverIds.add(m.id)
          insertStmt.run(m.id, m.company_id ?? null, m.entity_type, m.entity_id, m.url, m.sort_order ?? 0, m.is_primary ? 1 : 0)
          updateMetaStmt.run(m.company_id ?? null, m.entity_type, m.entity_id, m.url, m.sort_order ?? 0, m.is_primary ? 1 : 0, m.id)
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }

    // Phase B — purge records removed from server, delete local files
    const allLocal = db.prepare(
      `SELECT id, local_path FROM media WHERE entity_type = 'item'`,
    ).all() as { id: string; local_path: string | null }[]
    const deleteStmt = db.prepare(`DELETE FROM media WHERE id = ?`)
    for (const row of allLocal.filter((r) => !serverIds.has(r.id))) {
      if (row.local_path) {
        try { unlinkSync(join(mediaCacheDir, row.local_path)) } catch { /* non-critical */ }
      }
      deleteStmt.run(row.id)
    }

    // Phase C — download missing image files (async I/O outside any transaction)
    const toDownload = db.prepare(
      `SELECT id, url, local_path FROM media WHERE entity_type = 'item' AND url IS NOT NULL`,
    ).all() as { id: string; url: string; local_path: string | null }[]
    const updateLocalPathStmt = db.prepare(`UPDATE media SET local_path = ? WHERE id = ?`)
    for (const row of toDownload) {
      try {
        const urlPath = new URL(row.url).pathname
        const ext = extname(urlPath) || '.jpg'
        const filename = `${row.id}${ext}`
        const filePath = join(mediaCacheDir, filename)
        if (row.local_path === filename && existsSync(filePath)) continue
        const imgRes = await axios.get(row.url, {
          responseType: 'stream',
          timeout: 20_000,
          maxContentLength: 5 * 1024 * 1024,
          headers: { Authorization: `Bearer ${token}` },
        })
        await pipeline(imgRes.data, createWriteStream(filePath))
        updateLocalPathStmt.run(filename, row.id)
      } catch (e: unknown) {
        errors.push(`media-download ${row.id}: ${(e as Error).message}`)
      }
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

  // Parties (paginated) — all types pulled; search filters to customer+both at query time
  try {
    const stmt = db.prepare(
      `INSERT INTO pos_customers (id, server_id, name, phone, type, sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, 'synced', datetime('now'))
       ON CONFLICT(server_id) DO UPDATE SET
         name        = excluded.name,
         phone       = excluded.phone,
         type        = excluded.type,
         sync_status = 'synced'`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/parties?per_page=200&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? []
      if (rows.length === 0) break
      db.transaction((items: any[]) => {
        for (const p of items) {
          stmt.run(
            randomUUID(),
            p.id,
            p.name,
            p.phone ?? null,
            p.type ?? 'customer',
          )
          pulled++
        }
      })(rows)
      if (!payload.next_page_url && !payload.links?.next) break
      page++
    }
  } catch (e: unknown) { errors.push(`parties: ${(e as Error).message}`) }

  // Orders (paginated) — skip records where local sync_status='pending' to avoid overwriting unsent changes
  try {
    const invoiceStmt = db.prepare(`
      INSERT OR REPLACE INTO sales_invoices
        (id, server_id, order_type, table_id, pax, status, pos_held,
         grand_total, discount_amount, taxable_amount, cgst_total, sgst_total,
         amount_paid, amount_tendered, change_amount, balance_due,
         pos_payment_mode, kot_count, notes, invoice_number,
         sync_status, synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              'synced', datetime('now'), ?, ?)
    `)
    const lineStmt = db.prepare(`
      INSERT OR REPLACE INTO sales_invoice_lines
        (id, sales_invoice_id, item_id, item_name, quantity, rate,
         discount_percent, gst_rate, cgst, sgst, igst,
         taxable_amount, line_total, kot_status, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'synced')
    `)
    let page = 1
    while (true) {
      const res = await client.get(`/restaurant/orders?per_page=100&page=${page}`)
      const payload = res.data
      const rows: any[] = payload.data ?? payload ?? []
      if (rows.length === 0) break
      db.transaction((orders: any[]) => {
        for (const o of orders) {
          const existing = db.prepare(
            `SELECT sync_status FROM sales_invoices WHERE server_id = ? OR id = ?`,
          ).get(o.id, o.id) as { sync_status: string } | undefined
          if (existing?.sync_status === 'pending') continue

          invoiceStmt.run(
            o.id, o.id, o.order_type, o.table_id ?? null, o.pax ?? 1,
            o.status ?? 'draft', o.pos_held ? 1 : 0,
            Number(o.grand_total ?? 0), Number(o.discount_amount ?? 0),
            Number(o.taxable_amount ?? 0), Number(o.cgst_total ?? 0), Number(o.sgst_total ?? 0),
            Number(o.amount_paid ?? 0), Number(o.amount_tendered ?? 0),
            Number(o.change_amount ?? 0), Number(o.balance_due ?? 0),
            o.pos_payment_mode ?? null, o.kot_count ?? 0,
            o.notes ?? null, o.invoice_number ?? null,
            o.created_at ?? new Date().toISOString(),
            o.updated_at ?? new Date().toISOString(),
          )

          if (Array.isArray(o.lines)) {
            for (const l of o.lines) {
              const existingLine = db.prepare(
                `SELECT sync_status FROM sales_invoice_lines WHERE id = ?`,
              ).get(l.id) as { sync_status: string } | undefined
              if (existingLine?.sync_status === 'pending') continue
              lineStmt.run(
                l.id, o.id, l.item_id, l.item?.name ?? l.item_name ?? 'Item',
                l.quantity, l.rate, l.discount_percent ?? 0, l.gst_rate ?? 0,
                Number(l.cgst ?? 0), Number(l.sgst ?? 0),
                Number(l.taxable_amount ?? 0), Number(l.line_total ?? 0),
                l.kot_status ?? 'pending',
              )
            }
          }
          pulled++
        }
      })(rows)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) { errors.push(`orders: ${(e as Error).message}`) }

  db.close()
  parentPort?.postMessage({ pulled, pushed, errors })
}

run().catch((err) => {
  parentPort?.postMessage({ pulled: 0, pushed: 0, errors: [`worker crash: ${err.message}`] })
})
