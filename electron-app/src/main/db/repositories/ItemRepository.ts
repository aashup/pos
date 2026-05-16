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
  image_url: string | null
  has_variants: number
  has_modifiers: number
}

export interface ItemVariantRow {
  id: string
  item_id: string
  name: string
  price_override: number | null
  sku: string | null
  sort_order: number
  is_active: number
}

export interface ModifierRow {
  id: string
  modifier_group_id: string
  name: string
  price: number
  sort_order: number
  is_active: number
}

export interface ModifierGroupRow {
  id: string
  company_id: string
  name: string
  is_required: number
  min_selections: number
  max_selections: number
  sort_order: number
  is_active: number
}

export interface ModifierGroupWithModifiers extends ModifierGroupRow {
  modifiers: ModifierRow[]
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

  getAllForPOS(): POSItem[] {
    const db = getDb()
    return db
      .prepare(
        `SELECT i.*,
           (SELECT CASE
              WHEN local_path IS NOT NULL THEN 'media://' || local_path
              ELSE url
            END
            FROM media
            WHERE entity_type = 'item' AND entity_id = i.id
            ORDER BY is_primary DESC, sort_order ASC
            LIMIT 1) AS image_url,
           (SELECT COUNT(*) FROM item_variants
            WHERE item_id = i.id AND is_active = 1) AS has_variants,
           (SELECT COUNT(*) FROM item_modifier_groups
            WHERE item_id = i.id) AS has_modifiers
         FROM items i
         WHERE i.is_active = 1
         ORDER BY i.name
         LIMIT 500`,
      )
      .all() as POSItem[]
  },

  getVariants(itemId: string): ItemVariantRow[] {
    const db = getDb()
    return db
      .prepare(
        `SELECT id, item_id, name, price_override, sku, sort_order, is_active
         FROM item_variants
         WHERE item_id = ? AND is_active = 1
         ORDER BY sort_order ASC, name ASC`,
      )
      .all(itemId) as ItemVariantRow[]
  },

  getModifierGroupsForItem(itemId: string): ModifierGroupWithModifiers[] {
    const db = getDb()
    const groups = db
      .prepare(
        `SELECT mg.*
         FROM modifier_groups mg
         INNER JOIN item_modifier_groups img ON img.modifier_group_id = mg.id
         WHERE img.item_id = ? AND mg.is_active = 1
         ORDER BY img.sort_order ASC, mg.sort_order ASC`,
      )
      .all(itemId) as ModifierGroupRow[]

    const modStmt = db.prepare(
      `SELECT id, modifier_group_id, name, price, sort_order, is_active
       FROM modifiers
       WHERE modifier_group_id = ? AND is_active = 1
       ORDER BY sort_order ASC, name ASC`,
    )

    return groups.map((g) => ({
      ...g,
      modifiers: modStmt.all(g.id) as ModifierRow[],
    }))
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

  upsert(item: any): void {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO items
         (id, company_id, item_group_id, name, sku, selling_price, cgst, sgst, igst, unit, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      item.id,
      item.company_id ?? null,
      item.item_group_id ?? null,
      item.name,
      item.sku ?? null,
      Number(item.selling_price ?? 0),
      Number(item.cgst ?? 0),
      Number(item.sgst ?? 0),
      Number(item.igst ?? 0),
      item.unit ?? null,
      item.is_active ? 1 : 0,
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
