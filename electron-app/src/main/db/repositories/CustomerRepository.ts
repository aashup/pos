import { randomUUID } from 'crypto'
import { getDb } from '../database'

export interface LocalCustomer {
  id: string
  server_id: string | null
  name: string
  phone: string | null
  type: string
  sync_status: string
  created_at: string
}

export const CustomerRepository = {
  /** Search customers by name or phone. Only returns customer+both types (not vendor-only). */
  search(query: string): LocalCustomer[] {
    const db = getDb()
    const q = `%${query}%`
    return db
      .prepare(
        `SELECT id, server_id, name, phone, type, sync_status, created_at
         FROM pos_customers
         WHERE (name LIKE ? OR phone LIKE ?) AND type IN ('customer', 'both')
         ORDER BY name ASC LIMIT 20`,
      )
      .all(q, q) as LocalCustomer[]
  },

  create(name: string, phone?: string): LocalCustomer {
    const db = getDb()
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO pos_customers (id, server_id, name, phone, type, sync_status, created_at)
       VALUES (?, NULL, ?, ?, 'customer', 'pending', ?)`,
    ).run(id, name.trim(), phone?.trim() || null, now)
    return { id, server_id: null, name: name.trim(), phone: phone?.trim() || null, type: 'customer', sync_status: 'pending', created_at: now }
  },

  markSynced(id: string, serverId: string): void {
    getDb()
      .prepare(`UPDATE pos_customers SET server_id = ?, sync_status = 'synced' WHERE id = ?`)
      .run(serverId, id)
  },

  /**
   * Upsert a party record pulled from the server. Keyed on server_id.
   * On conflict (same server_id already cached), updates name/phone/type but never
   * overwrites a locally-created record that is still pending.
   */
  upsertFromServer(serverId: string, name: string, phone: string | null, type: string): void {
    getDb()
      .prepare(
        `INSERT INTO pos_customers (id, server_id, name, phone, type, sync_status, created_at)
         VALUES (?, ?, ?, ?, ?, 'synced', datetime('now'))
         ON CONFLICT(server_id) DO UPDATE SET
           name        = excluded.name,
           phone       = excluded.phone,
           type        = excluded.type,
           sync_status = 'synced'`,
      )
      .run(randomUUID(), serverId, name, phone, type)
  },

  getPending(): LocalCustomer[] {
    return getDb()
      .prepare(
        `SELECT id, server_id, name, phone, type, sync_status, created_at
         FROM pos_customers WHERE sync_status = 'pending' LIMIT 50`,
      )
      .all() as LocalCustomer[]
  },
}
