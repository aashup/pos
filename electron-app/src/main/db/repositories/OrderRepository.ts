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
  }): void {
    const db = getDb()
    const discountPct = line.discount_percent ?? 0
    const taxable = line.quantity * line.rate * (1 - discountPct / 100)
    const gstAmt = taxable * (line.gst_rate / 100)
    const half = gstAmt / 2
    db.prepare(`
      INSERT OR REPLACE INTO sales_invoice_lines
        (id, sales_invoice_id, item_id, item_name, quantity, rate,
         discount_percent, gst_rate, cgst, sgst, igst,
         taxable_amount, line_total, kot_status, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', 'pending')
    `).run(
      line.id, invoiceId, line.item_id, line.item_name,
      line.quantity, line.rate, discountPct, line.gst_rate,
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
}
