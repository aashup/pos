import { getDb } from '../database'

export interface POSCombo {
  id: string
  company_id: string
  name: string
  description: string | null
  price: number
  cgst: number
  sgst: number
  igst: number
  sort_order: number
  is_active: number
  image_url: string | null
}

export const ComboRepository = {
  getAll(): POSCombo[] {
    return getDb()
      .prepare(
        `SELECT c.*,
           (SELECT CASE
              WHEN local_path IS NOT NULL THEN 'media:///' || local_path
              ELSE url
            END
            FROM media WHERE entity_type = 'combo' AND entity_id = c.id
            ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image_url
         FROM combos c
         WHERE c.is_active = 1
         ORDER BY c.sort_order, c.name`,
      )
      .all() as POSCombo[]
  },

  upsert(combo: {
    id: string
    company_id?: string | null
    name: string
    description?: string | null
    price?: number | string
    cgst?: number | string
    sgst?: number | string
    igst?: number | string
    sort_order?: number
    is_active?: boolean | number
  }): void {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO combos
           (id, company_id, name, description, price, cgst, sgst, igst, sort_order, is_active, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        combo.id,
        combo.company_id ?? null,
        combo.name,
        combo.description ?? null,
        Number(combo.price ?? 0),
        Number(combo.cgst ?? 0),
        Number(combo.sgst ?? 0),
        Number(combo.igst ?? 0),
        combo.sort_order ?? 0,
        combo.is_active ? 1 : 0,
      )
  },
}
