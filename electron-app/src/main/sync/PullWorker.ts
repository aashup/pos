import axios from 'axios'
import { TokenStore } from '../auth/TokenStore'
import { ItemRepository } from '../db/repositories/ItemRepository'
import { TableRepository } from '../db/repositories/TableRepository'
import { UnitRepository } from '../db/repositories/UnitRepository'
import { getDb } from '../db/database'

export interface PullResult {
  pulled: number
  errors: string[]
}

export async function pullFromServer(): Promise<PullResult> {
  const token = TokenStore.getToken()
  const serverUrl = TokenStore.getSetting('serverUrl')

  if (!token || !serverUrl) return { pulled: 0, errors: ['Not authenticated'] }

  const client = axios.create({
    baseURL: `${serverUrl}/api/v1`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 15000,
  })

  let pulled = 0
  const errors: string[] = []
  const db = getDb()

  // ── Units ─────────────────────────────────────────────────────────────────
  try {
    const res = await client.get('/units?per_page=500&status=active')
    const units: any[] = res.data?.data ?? res.data ?? []
    const insertMany = db.transaction((rows: any[]) => {
      for (const u of rows) { UnitRepository.upsert(u); pulled++ }
    })
    insertMany(units)
  } catch (e: unknown) {
    errors.push(`units: ${(e as Error).message}`)
  }

  // ── Item groups ───────────────────────────────────────────────────────────
  try {
    const res = await client.get('/item-groups?per_page=500')
    const groups: any[] = res.data?.data ?? res.data ?? []
    const insertMany = db.transaction((rows: any[]) => {
      for (const g of rows) { ItemRepository.upsertGroup(g); pulled++ }
    })
    insertMany(groups)
  } catch (e: unknown) {
    errors.push(`item-groups: ${(e as Error).message}`)
  }

  // ── Items (paginated) ─────────────────────────────────────────────────────
  try {
    let page = 1
    while (true) {
      const res = await client.get(`/items?per_page=200&page=${page}&is_active=true`)
      const payload = res.data
      const records: any[] = payload.data ?? payload ?? []
      if (records.length === 0) break
      const insertMany = db.transaction((rows: any[]) => {
        for (const item of rows) { ItemRepository.upsert(item); pulled++ }
      })
      insertMany(records)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) {
    errors.push(`items: ${(e as Error).message}`)
  }

  // ── Item media (paginated) ────────────────────────────────────────────────
  try {
    const upsertMedia = db.prepare(
      `INSERT OR REPLACE INTO media (id, company_id, entity_type, entity_id, url, sort_order, is_primary, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    const insertMany = db.transaction((rows: any[]) => {
      for (const m of rows) {
        upsertMedia.run(m.id, m.company_id ?? null, 'item', m.entity_id, m.url, m.sort_order ?? 0, m.is_primary ? 1 : 0)
        pulled++
      }
    })
    let page = 1
    while (true) {
      const res = await client.get(`/media?entity_type=item&per_page=200&page=${page}`)
      const payload = res.data
      const records: any[] = payload.data ?? payload ?? []
      if (records.length === 0) break
      insertMany(records)
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) {
    errors.push(`media: ${(e as Error).message}`)
  }

  // ── Floor plans ───────────────────────────────────────────────────────────
  try {
    const res = await client.get('/floor-plans')
    const plans: any[] = res.data?.data ?? []
    const insertMany = db.transaction((rows: any[]) => {
      for (const fp of rows) { TableRepository.upsertFloorPlan(fp); pulled++ }
    })
    insertMany(plans)
  } catch (e: unknown) {
    errors.push(`floor-plans: ${(e as Error).message}`)
  }

  // ── Dining tables ─────────────────────────────────────────────────────────
  try {
    const res = await client.get('/dining-tables?is_active=1')
    const tables: any[] = res.data?.data ?? []
    const insertMany = db.transaction((rows: any[]) => {
      for (const t of rows) { TableRepository.upsert(t); pulled++ }
    })
    insertMany(tables)
  } catch (e: unknown) {
    errors.push(`dining-tables: ${(e as Error).message}`)
  }

  // ── Godowns ───────────────────────────────────────────────────────────────
  try {
    const res = await client.get('/godowns')
    const godowns: any[] = res.data?.data ?? []
    const upsertGodown = db.prepare(
      `INSERT OR REPLACE INTO godowns (id, company_id, name, is_default, synced_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    const insertMany = db.transaction((rows: any[]) => {
      for (const g of rows) {
        upsertGodown.run(g.id, g.company_id, g.name, g.is_default ? 1 : 0)
        pulled++
      }
    })
    insertMany(godowns)
  } catch (e: unknown) {
    errors.push(`godowns: ${(e as Error).message}`)
  }

  return { pulled, errors }
}
