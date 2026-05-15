import { randomUUID } from 'crypto'
import { getDb } from '../database'

export interface LocalKotLine {
  item_name: string
  quantity: number
  notes: string | null
}

export interface LocalKot {
  id: string
  kot_number: string
  sales_invoice_id: string
  lines: LocalKotLine[]
}

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

export const OrderRepository = {
  /**
   * Create a new draft order in SQLite. Returns the local UUID.
   */
  createOrder(data: {
    order_type: string
    table_id?: string | null
    pax?: number
  }): string {
    const db = getDb()
    const id = randomUUID()
    db.prepare(`
      INSERT INTO sales_invoices
        (id, order_type, table_id, pax, status, sync_status, invoice_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'draft', 'pending', datetime('now'), datetime('now'), datetime('now'))
    `).run(id, data.order_type, data.table_id ?? null, data.pax ?? 1)
    return id
  },

  /**
   * Insert a new invoice line. The caller supplies the line UUID so it matches
   * the Zustand CartLine id.
   */
  addLine(invoiceId: string, line: {
    id: string
    item_id: string
    item_name: string
    quantity: number
    rate: number
    discount_percent: number
    gst_rate: number
    notes?: string | null
    item_variant_id?: string | null
    modifiers_total?: number
  }): void {
    const db = getDb()
    const discountPct = line.discount_percent ?? 0
    const modifiersTotal = line.modifiers_total ?? 0
    const effectiveRate = line.rate + modifiersTotal
    const taxable = line.quantity * effectiveRate * (1 - discountPct / 100)
    const gstAmt = taxable * (line.gst_rate / 100)
    const half = gstAmt / 2
    db.prepare(`
      INSERT OR REPLACE INTO sales_invoice_lines
        (id, sales_invoice_id, item_id, item_variant_id, item_name, quantity, rate,
         discount_percent, modifiers_total, gst_rate, cgst, sgst, igst,
         taxable_amount, line_total, kot_status, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', 'pending')
    `).run(
      line.id, invoiceId, line.item_id, line.item_variant_id ?? null, line.item_name,
      line.quantity, line.rate, discountPct, modifiersTotal, line.gst_rate,
      half, half, taxable, taxable + gstAmt,
    )
  },

  /**
   * Recalculate and update the quantity (and derived amounts) for an existing line.
   */
  updateLineQty(lineId: string, qty: number): void {
    const db = getDb()
    const row = db.prepare('SELECT * FROM sales_invoice_lines WHERE id = ?').get(lineId) as Record<string, number> | undefined
    if (!row) return
    const discountPct = Number(row.discount_percent ?? 0)
    const taxable = qty * Number(row.rate) * (1 - discountPct / 100)
    const gstAmt = taxable * (Number(row.gst_rate) / 100)
    const half = gstAmt / 2
    db.prepare(`
      UPDATE sales_invoice_lines
      SET quantity = ?, taxable_amount = ?, cgst = ?, sgst = ?, line_total = ?
      WHERE id = ?
    `).run(qty, taxable, half, half, taxable + gstAmt, lineId)
  },

  /**
   * Delete a pending line (only removes lines not yet sent to kitchen).
   */
  removeLine(lineId: string): void {
    const db = getDb()
    db.prepare(`DELETE FROM sales_invoice_lines WHERE id = ? AND kot_status = 'pending'`).run(lineId)
  },

  /**
   * Create a local KOT for all pending lines in the given order.
   * Marks those lines as kot_status='sent' and increments kot_count.
   * Returns null if there are no pending lines.
   */
  createKot(invoiceId: string): LocalKot | null {
    const db = getDb()

    const pendingLines = db.prepare(`
      SELECT sil.*, COALESCE(sil.item_name, i.name, 'Item') AS display_name
      FROM sales_invoice_lines sil
      LEFT JOIN items i ON sil.item_id = i.id
      WHERE sil.sales_invoice_id = ? AND sil.kot_status = 'pending'
    `).all(invoiceId) as Record<string, any>[]

    if (pendingLines.length === 0) return null

    const kotSeq = ((db.prepare(
      'SELECT COUNT(*) AS cnt FROM kots WHERE sales_invoice_id = ?',
    ).get(invoiceId) as { cnt: number })?.cnt ?? 0) + 1

    const kotNumber = `KOT-${invoiceId.slice(-6).toUpperCase()}-${kotSeq}`
    const kotId = randomUUID()

    db.transaction(() => {
      db.prepare(`
        INSERT INTO kots (id, sales_invoice_id, kot_number, status, sync_status, created_at)
        VALUES (?, ?, ?, 'new', 'pending', datetime('now'))
      `).run(kotId, invoiceId, kotNumber)

      for (const line of pendingLines) {
        db.prepare(`
          INSERT INTO kot_lines (id, kot_id, item_id, item_name, quantity, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).run(randomUUID(), kotId, line.item_id, line.display_name, line.quantity, line.notes ?? null)

        db.prepare(`UPDATE sales_invoice_lines SET kot_status = 'sent' WHERE id = ?`).run(line.id)
      }

      db.prepare(`UPDATE sales_invoices SET kot_count = kot_count + 1 WHERE id = ?`).run(invoiceId)
    })()

    return {
      id: kotId,
      kot_number: kotNumber,
      sales_invoice_id: invoiceId,
      lines: pendingLines.map((l) => ({
        item_name: l.display_name as string,
        quantity: l.quantity as number,
        notes: l.notes as string | null,
      })),
    }
  },

  /**
   * After the server creates the order, store its UUID so SyncWorker skips re-push.
   */
  setServerId(localId: string, serverId: string): void {
    const db = getDb()
    db.prepare(`UPDATE sales_invoices SET server_id = ? WHERE id = ?`).run(serverId, localId)
  },

  /**
   * Mark lines as synced to server (so background KOT push doesn't re-send them).
   */
  markLinesSynced(invoiceId: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE sales_invoice_lines SET sync_status = 'synced'
      WHERE sales_invoice_id = ? AND sync_status = 'pending'
    `).run(invoiceId)
  },

  /**
   * After checkout completes on the server, mark local order confirmed+synced
   * so SyncWorker doesn't attempt a duplicate push.
   */
  markConfirmed(localId: string, serverId?: string | null): void {
    const db = getDb()
    if (serverId) {
      db.prepare(`
        UPDATE sales_invoices
        SET status = 'confirmed', sync_status = 'synced', server_id = ?, synced_at = datetime('now')
        WHERE id = ?
      `).run(serverId, localId)
    } else {
      db.prepare(`
        UPDATE sales_invoices
        SET status = 'confirmed', sync_status = 'synced', synced_at = datetime('now')
        WHERE id = ?
      `).run(localId)
    }
  },

  /**
   * Find the most recent draft order for a given table (used to resume an order
   * after app restart or navigation away). Returns the order with its lines, or
   * null if no draft exists for that table.
   */
  findActiveByTableId(tableId: string): LocalActiveOrder | null {
    const db = getDb()
    const order = db.prepare(`
      SELECT id, order_type
      FROM sales_invoices
      WHERE table_id = ? AND status = 'draft'
      ORDER BY created_at DESC LIMIT 1
    `).get(tableId) as Record<string, string> | undefined
    if (!order) return null

    const lines = db.prepare(`
      SELECT sil.id, sil.item_id, sil.item_name, sil.item_variant_id,
             sil.quantity, sil.rate, sil.discount_percent, sil.gst_rate,
             sil.notes, sil.kot_status,
             COALESCE(i.unit, 'PCS') AS unit
      FROM sales_invoice_lines sil
      LEFT JOIN items i ON sil.item_id = i.id
      WHERE sil.sales_invoice_id = ? AND sil.kot_status != 'served'
      ORDER BY sil.rowid
    `).all(order.id) as LocalOrderLine[]

    return { id: order.id, order_type: order.order_type, lines }
  },

  getOrder(localId: string): Record<string, any> | null {
    const db = getDb()
    return (db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(localId) as Record<string, any>) ?? null
  },

  getPendingLines(invoiceId: string): Record<string, any>[] {
    const db = getDb()
    return db.prepare(`
      SELECT sil.*, COALESCE(sil.item_name, i.name, 'Item') AS display_name
      FROM sales_invoice_lines sil
      LEFT JOIN items i ON sil.item_id = i.id
      WHERE sil.sales_invoice_id = ? AND sil.sync_status = 'pending'
    `).all(invoiceId) as Record<string, any>[]
  },

  list(filters?: { status?: string; today?: boolean }): LocalOrderSummary[] {
    const db = getDb()
    const conditions: string[] = []
    if (filters?.status) conditions.push(`si.status = '${filters.status}'`)
    if (filters?.today) conditions.push(`date(si.created_at) = date('now')`)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    return db.prepare(`
      SELECT si.id, si.server_id, si.order_type, si.table_id,
             dt.name AS table_name, si.pax, si.status, si.pos_held,
             si.grand_total, si.discount_amount, si.taxable_amount,
             si.cgst_total, si.sgst_total, si.pos_payment_mode,
             si.kot_count, si.notes, si.invoice_number, si.sync_status,
             si.created_at,
             COUNT(sil.id) AS line_count,
             COALESCE(SUM(sil.line_total), 0) AS computed_total,
             SUM(CASE WHEN sil.kot_status = 'pending' THEN 1 ELSE 0 END) AS pending_line_count,
             (SELECT k.status FROM kots k WHERE k.sales_invoice_id = si.id ORDER BY k.created_at DESC LIMIT 1) AS latest_kot_status
      FROM sales_invoices si
      LEFT JOIN dining_tables dt ON si.table_id = dt.id
      LEFT JOIN sales_invoice_lines sil ON sil.sales_invoice_id = si.id
      ${where}
      GROUP BY si.id
      ORDER BY si.created_at DESC
      LIMIT 200
    `).all() as LocalOrderSummary[]
  },

  getById(id: string): LocalOrderFull | null {
    const db = getDb()
    const order = db.prepare(`
      SELECT si.*, dt.name AS table_name
      FROM sales_invoices si
      LEFT JOIN dining_tables dt ON si.table_id = dt.id
      WHERE si.id = ?
    `).get(id) as Record<string, any> | undefined
    if (!order) return null
    const lines = db.prepare(`
      SELECT sil.id, sil.item_id, sil.item_name, sil.item_variant_id,
             sil.quantity, sil.rate, sil.discount_percent, sil.gst_rate,
             sil.notes, sil.kot_status, sil.line_total,
             COALESCE(i.unit, 'PCS') AS unit
      FROM sales_invoice_lines sil
      LEFT JOIN items i ON sil.item_id = i.id
      WHERE sil.sales_invoice_id = ?
      ORDER BY sil.rowid
    `).all(id) as LocalOrderLine[]
    return { ...(order as any), lines }
  },

  listHeld(): (LocalOrderSummary & { lines: LocalOrderLine[] })[] {
    const db = getDb()
    const orders = db.prepare(`
      SELECT si.id, si.server_id, si.order_type, si.table_id,
             dt.name AS table_name, si.pax, si.status, si.pos_held,
             si.grand_total, si.discount_amount, si.taxable_amount,
             si.cgst_total, si.sgst_total, si.pos_payment_mode,
             si.kot_count, si.notes, si.invoice_number, si.sync_status,
             si.created_at,
             COUNT(sil.id) AS line_count
      FROM sales_invoices si
      LEFT JOIN dining_tables dt ON si.table_id = dt.id
      LEFT JOIN sales_invoice_lines sil ON sil.sales_invoice_id = si.id
      WHERE si.pos_held = 1 AND si.status = 'draft'
      GROUP BY si.id
      ORDER BY si.created_at DESC
    `).all() as LocalOrderSummary[]

    return orders.map((o) => {
      const lines = db.prepare(`
        SELECT sil.id, sil.item_id, sil.item_name, sil.item_variant_id,
               sil.quantity, sil.rate, sil.discount_percent, sil.gst_rate,
               sil.notes, sil.kot_status, sil.line_total,
               COALESCE(i.unit, 'PCS') AS unit
        FROM sales_invoice_lines sil
        LEFT JOIN items i ON sil.item_id = i.id
        WHERE sil.sales_invoice_id = ?
        ORDER BY sil.rowid
      `).all(o.id) as LocalOrderLine[]
      return { ...o, lines }
    })
  },

  hold(id: string): void {
    getDb().prepare(
      `UPDATE sales_invoices SET pos_held = 1, updated_at_local = datetime('now') WHERE id = ?`,
    ).run(id)
  },

  unhold(id: string): void {
    getDb().prepare(
      `UPDATE sales_invoices SET pos_held = 0, updated_at_local = datetime('now') WHERE id = ?`,
    ).run(id)
  },

  cancel(id: string): void {
    getDb().prepare(
      `UPDATE sales_invoices SET status = 'cancelled', sync_status = 'pending', updated_at_local = datetime('now') WHERE id = ?`,
    ).run(id)
  },

  checkout(id: string, data: CheckoutData): void {
    getDb().prepare(`
      UPDATE sales_invoices SET
        status = 'confirmed',
        sync_status = 'pending',
        pos_payment_mode = ?,
        grand_total = ?,
        taxable_amount = ?,
        cgst_total = ?,
        sgst_total = ?,
        amount_paid = ?,
        amount_tendered = ?,
        change_amount = ?,
        balance_due = ?,
        discount_amount = ?,
        notes = COALESCE(?, notes),
        updated_at_local = datetime('now')
      WHERE id = ?
    `).run(
      data.payment_mode,
      data.grand_total,
      data.taxable_amount,
      data.cgst_total,
      data.sgst_total,
      data.amount_paid,
      data.amount_tendered,
      data.change_amount,
      data.balance_due,
      data.discount_amount,
      data.notes ?? null,
      id,
    )
  },

  upsertFromServer(order: Record<string, any>): void {
    const db = getDb()
    const existing = db.prepare(
      `SELECT sync_status FROM sales_invoices WHERE server_id = ? OR id = ?`,
    ).get(order.id, order.id) as { sync_status: string } | undefined
    if (existing?.sync_status === 'pending') return

    db.prepare(`
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
    `).run(
      order.id, order.id, order.order_type, order.table_id ?? null, order.pax ?? 1,
      order.status ?? 'draft', order.pos_held ? 1 : 0,
      Number(order.grand_total ?? 0), Number(order.discount_amount ?? 0),
      Number(order.taxable_amount ?? 0), Number(order.cgst_total ?? 0), Number(order.sgst_total ?? 0),
      Number(order.amount_paid ?? 0), Number(order.amount_tendered ?? 0),
      Number(order.change_amount ?? 0), Number(order.balance_due ?? 0),
      order.pos_payment_mode ?? null, order.kot_count ?? 0,
      order.notes ?? null, order.invoice_number ?? null,
      order.created_at ?? new Date().toISOString(),
      order.updated_at ?? new Date().toISOString(),
    )

    if (Array.isArray(order.lines)) {
      for (const l of order.lines) {
        const existingLine = db.prepare(
          `SELECT sync_status FROM sales_invoice_lines WHERE id = ?`,
        ).get(l.id) as { sync_status: string } | undefined
        if (existingLine?.sync_status === 'pending') continue
        db.prepare(`
          INSERT OR REPLACE INTO sales_invoice_lines
            (id, sales_invoice_id, item_id, item_name, quantity, rate,
             discount_percent, gst_rate, cgst, sgst, igst,
             taxable_amount, line_total, kot_status, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'synced')
        `).run(
          l.id, order.id, l.item_id, l.item?.name ?? l.item_name ?? 'Item',
          l.quantity, l.rate, l.discount_percent ?? 0, l.gst_rate ?? 0,
          Number(l.cgst ?? 0), Number(l.sgst ?? 0),
          Number(l.taxable_amount ?? 0), Number(l.line_total ?? 0),
          l.kot_status ?? 'pending',
        )
      }
    }
  },
}
