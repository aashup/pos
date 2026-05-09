import axios from 'axios'
import { TokenStore } from '../auth/TokenStore'
import { getDb } from '../db/database'

export interface PushResult {
  pushed: number
  errors: string[]
}

export async function pushToServer(): Promise<PushResult> {
  const token = TokenStore.getToken()
  const serverUrl = TokenStore.getSetting('serverUrl')

  if (!token || !serverUrl) return { pushed: 0, errors: ['Not authenticated'] }

  const db = getDb()
  const client = axios.create({
    baseURL: `${serverUrl}/api/v1`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000,
  })

  let pushed = 0
  const errors: string[] = []

  // Get all pending confirmed invoices
  const pendingInvoices = db
    .prepare(`SELECT * FROM sales_invoices WHERE sync_status = 'pending' AND status = 'confirmed' LIMIT 50`)
    .all() as Record<string, unknown>[]

  for (const invoice of pendingInvoices) {
    try {
      const lines = db
        .prepare('SELECT * FROM sales_invoice_lines WHERE sales_invoice_id = ?')
        .all(invoice.id) as Record<string, unknown>[]

      // Map local columns to API format
      const payload = {
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
      }

      await client.post('/restaurant/orders', payload)

      db.prepare(`UPDATE sales_invoices SET sync_status = 'synced', synced_at = datetime('now') WHERE id = ?`).run(
        invoice.id,
      )
      pushed++
    } catch (e: unknown) {
      errors.push(`invoice ${invoice.id}: ${(e as Error).message}`)
      db.prepare(`UPDATE sales_invoices SET sync_status = 'failed' WHERE id = ?`).run(invoice.id)
    }
  }

  return { pushed, errors }
}
