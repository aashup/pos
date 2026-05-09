import { getDb } from '../database'

export interface POSItem {
  id: string
  company_id: string
  item_group_id: string | null
  name: string
  sku: string | null
  selling_price: number
  cgst: number
  sgst: number
  igst: number
  unit: string
  is_active: number
}

export interface POSItemGroup {
  id: string
  name: string
  parent_id: string | null
}

export const ItemRepository = {
  search(query: string, groupId?: string, companyId?: string): POSItem[] {
    const db = getDb()
    const like = `%${query}%`
    const companyFilter = companyId ? 'AND i.company_id = ?' : ''
    const groupFilter = groupId ? 'AND i.item_group_id = ?' : ''

    const params: (string | number)[] = [like, like]
    if (companyId) params.push(companyId)
    if (groupId) params.push(groupId)

    return db
      .prepare(
        `SELECT i.*
         FROM items i
         WHERE i.is_active = 1
           AND (i.name LIKE ? OR i.sku LIKE ?)
           ${companyFilter}
           ${groupFilter}
         ORDER BY i.name
         LIMIT 80`,
      )
      .all(...params) as POSItem[]
  },

  getAll(companyId?: string): POSItem[] {
    const db = getDb()
    if (companyId) {
      return db
        .prepare('SELECT * FROM items WHERE is_active = 1 AND company_id = ? ORDER BY name')
        .all(companyId) as POSItem[]
    }
    return db.prepare('SELECT * FROM items WHERE is_active = 1 ORDER BY name').all() as POSItem[]
  },

  getGroups(companyId?: string): POSItemGroup[] {
    const db = getDb()
    if (companyId) {
      return db
        .prepare('SELECT id, name, parent_id FROM item_groups WHERE is_active = 1 AND company_id = ? ORDER BY name')
        .all(companyId) as POSItemGroup[]
    }
    return db.prepare('SELECT id, name, parent_id FROM item_groups WHERE is_active = 1 ORDER BY name').all() as POSItemGroup[]
  },

  upsert(item: POSItem): void {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO items
         (id, company_id, item_group_id, name, sku, selling_price, cgst, sgst, igst, unit, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      item.id,
      item.company_id,
      item.item_group_id,
      item.name,
      item.sku,
      item.selling_price,
      item.cgst,
      item.sgst,
      item.igst,
      item.unit,
      item.is_active,
    )
  },

  upsertGroup(group: POSItemGroup & { company_id: string; is_active: number }): void {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO item_groups (id, company_id, parent_id, name, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(group.id, group.company_id, group.parent_id, group.name, group.is_active)
  },
}
