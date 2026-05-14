import { getDb } from '../database'

interface ServerKotLine {
  id: string
  item_id: string
  item_name: string
  variant_name: string | null
  modifier_summary: string | null
  quantity: number
  notes: string | null
  status: string
}

interface ServerKot {
  id: string
  sales_invoice_id: string
  kot_number: string
  status: string
  notes: string | null
  print_count: number
  created_at: string
  lines?: ServerKotLine[]
}

export interface LocalKotLine {
  id: string
  kot_id: string
  item_id: string
  item_name: string
  variant_name: string | null
  modifier_summary: string | null
  quantity: number
  notes: string | null
  status: string
}

export interface ActiveKot {
  id: string
  server_id: string | null
  sales_invoice_id: string
  kot_number: string
  status: string
  notes: string | null
  print_count: number
  sync_status: string
  created_at: string
  lines: LocalKotLine[]
}

export const KotRepository = {
  listActive(): ActiveKot[] {
    const db = getDb()
    const kots = db.prepare(`
      SELECT id, server_id, sales_invoice_id, kot_number, status, notes, print_count, sync_status, created_at
      FROM kots
      WHERE status IN ('new', 'in_progress', 'ready')
      ORDER BY created_at ASC
    `).all() as Record<string, any>[]

    return kots.map((k) => ({
      ...k,
      lines: db.prepare(`
        SELECT id, kot_id, item_id, item_name, variant_name, modifier_summary, quantity, notes, status
        FROM kot_lines WHERE kot_id = ? ORDER BY rowid
      `).all(k.id) as LocalKotLine[],
    })) as ActiveKot[]
  },

  updateStatus(id: string, status: string): void {
    const db = getDb()
    db.transaction(() => {
      db.prepare(`
        UPDATE kots SET status = ?, sync_status = 'pending', updated_at_local = datetime('now')
        WHERE id = ?
      `).run(status, id)

      // When marking ready, auto-advance all pending/cooking lines
      if (status === 'ready') {
        db.prepare(`
          UPDATE kot_lines SET status = 'ready'
          WHERE kot_id = ? AND status IN ('pending', 'cooking')
        `).run(id)
      }
    })()
  },

  updateLineStatus(kotId: string, lineId: string, status: string): void {
    const db = getDb()
    db.transaction(() => {
      db.prepare(`UPDATE kot_lines SET status = ? WHERE id = ? AND kot_id = ?`).run(status, lineId, kotId)

      // Auto-advance KOT new → in_progress when any line starts cooking
      if (status === 'cooking') {
        db.prepare(`
          UPDATE kots SET status = 'in_progress', sync_status = 'pending', updated_at_local = datetime('now')
          WHERE id = ? AND status = 'new'
        `).run(kotId)
      }

      // Auto-advance KOT → ready when all lines are ready
      if (status === 'ready') {
        const { cnt } = db.prepare(
          `SELECT COUNT(*) AS cnt FROM kot_lines WHERE kot_id = ? AND status != 'ready'`,
        ).get(kotId) as { cnt: number }
        if (cnt === 0) {
          db.prepare(`
            UPDATE kots SET status = 'ready', sync_status = 'pending', updated_at_local = datetime('now')
            WHERE id = ?
          `).run(kotId)
        }
      }
    })()
  },

  /**
   * Merge a KOT from the server into local SQLite.
   * Matches by server_id to avoid duplicates across devices.
   * Does not overwrite local changes that are still pending sync.
   */
  upsertFromServer(kot: ServerKot): void {
    const db = getDb()
    const existing = db.prepare(
      `SELECT id, sync_status FROM kots WHERE id = ? OR server_id = ?`,
    ).get(kot.id, kot.id) as Record<string, any> | undefined

    db.transaction(() => {
      if (existing) {
        // Don't overwrite pending local status changes
        if (existing.sync_status !== 'pending') {
          db.prepare(`
            UPDATE kots SET status = ?, notes = ?, print_count = ?, sync_status = 'synced', synced_at = datetime('now')
            WHERE id = ?
          `).run(kot.status, kot.notes ?? null, kot.print_count ?? 0, existing.id)
        
          for (const line of kot.lines ?? []) {
            db.prepare(`
              INSERT INTO kot_lines (id, kot_id, item_id, item_name, variant_name, modifier_summary, quantity, notes, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(kot_id, item_id) 
              DO UPDATE SET 
                quantity = excluded.quantity,
                status = excluded.status,
                notes = excluded.notes
            `).run(
              line.id, 
              existing.id, 
              line.item_id, 
              line.item_name,
              line.variant_name ?? null, 
              line.modifier_summary ?? null,
              line.quantity, 
              line.notes ?? null, 
              line.status
            )
          }
        }
      } else {
        // New KOT from another device
        db.prepare(`
          INSERT INTO kots (id, server_id, sales_invoice_id, kot_number, status, notes, print_count, sync_status, synced_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), ?)
        `).run(
          kot.id, kot.id, kot.sales_invoice_id, kot.kot_number,
          kot.status, kot.notes ?? null, kot.print_count ?? 0,
          kot.created_at ?? new Date().toISOString(),
        )
        for (const line of kot.lines ?? []) {
          db.prepare(`
            INSERT OR IGNORE INTO kot_lines (id, kot_id, item_id, item_name, variant_name, modifier_summary, quantity, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            line.id, kot.id, line.item_id, line.item_name,
            line.variant_name ?? null, line.modifier_summary ?? null,
            line.quantity, line.notes ?? null, line.status,
          )
        }
      }
    })()
  },

  /** Called after background push to server succeeds — records server UUID and marks synced. */
  setServerId(localId: string, serverId: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE kots SET server_id = ?, sync_status = 'synced', synced_at = datetime('now')
      WHERE id = ?
    `).run(serverId, localId)
  },

  /** Mark a KOT as synced after a successful status push to the server. */
  markSynced(id: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE kots SET sync_status = 'synced', synced_at = datetime('now') WHERE id = ?
    `).run(id)
  },

  /** Return the server_id for a given local KOT id (used by background push). */
  getServerId(id: string): string | null {
    const db = getDb()
    const row = db.prepare('SELECT server_id FROM kots WHERE id = ?').get(id) as { server_id: string | null } | undefined
    return row?.server_id ?? null
  },
}
