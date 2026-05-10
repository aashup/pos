import { getDb } from '../database'

export interface POSUnit {
  id: string
  company_id: string
  value: string
  label: string
  status: string
}

export const UnitRepository = {
  getAll(): POSUnit[] {
    const db = getDb()
    return db
      .prepare(`SELECT id, company_id, value, label, status FROM units WHERE status = 'active' ORDER BY value`)
      .all() as POSUnit[]
  },

  upsert(unit: POSUnit): void {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO units (id, company_id, value, label, status, synced_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(unit.id, unit.company_id, unit.value, unit.label, unit.status)
  },
}
