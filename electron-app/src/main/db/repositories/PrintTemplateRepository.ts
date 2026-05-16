import { getDb } from '../database'

export interface LocalPrintTemplate {
  id: string
  type: 'kot' | 'invoice'
  name: string
  layout: string
  is_active: number
  server_id: string | null
  sync_status: string
  updated_at: string | null
  created_at: string
}

export const PrintTemplateRepository = {
  getAll(): LocalPrintTemplate[] {
    const db = getDb()
    return db.prepare('SELECT * FROM print_templates ORDER BY type, created_at').all() as LocalPrintTemplate[]
  },

  getActiveByType(type: 'kot' | 'invoice'): LocalPrintTemplate | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM print_templates WHERE type = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1')
      .get(type) as LocalPrintTemplate | undefined
    return row ?? null
  },

  upsert(template: LocalPrintTemplate): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO print_templates (id, type, name, layout, is_active, server_id, sync_status, updated_at, created_at)
      VALUES (@id, @type, @name, @layout, @is_active, @server_id, @sync_status, @updated_at, @created_at)
      ON CONFLICT(id) DO UPDATE SET
        name       = excluded.name,
        layout     = excluded.layout,
        is_active  = excluded.is_active,
        server_id  = excluded.server_id,
        sync_status = excluded.sync_status,
        updated_at = excluded.updated_at
    `).run(template)
  },

  bulkUpsert(templates: LocalPrintTemplate[]): void {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO print_templates (id, type, name, layout, is_active, server_id, sync_status, updated_at, created_at)
      VALUES (@id, @type, @name, @layout, @is_active, @server_id, @sync_status, @updated_at, @created_at)
      ON CONFLICT(id) DO UPDATE SET
        name       = excluded.name,
        layout     = excluded.layout,
        is_active  = excluded.is_active,
        server_id  = excluded.server_id,
        sync_status = excluded.sync_status,
        updated_at = excluded.updated_at
    `)
    const runAll = db.transaction((rows: LocalPrintTemplate[]) => {
      for (const row of rows) stmt.run(row)
    })
    runAll(templates)
  },
}
