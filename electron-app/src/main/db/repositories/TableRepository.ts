import { getDb } from '../database'

export interface LocalTable {
  id: string
  company_id: string
  floor_plan_id: string
  name: string
  capacity: number
  shape: string
  pos_x: number
  pos_y: number
  status: string
  current_order_id: string | null
  is_active: number
}

export interface LocalFloorPlan {
  id: string
  company_id: string
  name: string
  sort_order: number
}

export const TableRepository = {
  getAll(): LocalTable[] {
    return getDb().prepare('SELECT * FROM dining_tables WHERE is_active = 1 ORDER BY pos_y, pos_x').all() as LocalTable[]
  },

  getFloorPlans(): LocalFloorPlan[] {
    return getDb().prepare('SELECT * FROM floor_plans ORDER BY sort_order').all() as LocalFloorPlan[]
  },

  updateStatus(id: string, status: string, currentOrderId: string | null): void {
    getDb()
      .prepare('UPDATE dining_tables SET status = ?, current_order_id = ?, updated_at_local = datetime(\'now\') WHERE id = ?')
      .run(status, currentOrderId, id)
  },

  upsert(table: LocalTable): void {
    getDb().prepare(
      `INSERT OR REPLACE INTO dining_tables
         (id, company_id, floor_plan_id, name, capacity, shape, pos_x, pos_y,
          status, current_order_id, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      table.id, table.company_id, table.floor_plan_id, table.name,
      table.capacity, table.shape, table.pos_x, table.pos_y,
      table.status, table.current_order_id, table.is_active,
    )
  },

  upsertFloorPlan(fp: LocalFloorPlan): void {
    getDb().prepare(
      `INSERT OR REPLACE INTO floor_plans (id, company_id, name, sort_order, synced_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    ).run(fp.id, fp.company_id, fp.name, fp.sort_order)
  },
}
