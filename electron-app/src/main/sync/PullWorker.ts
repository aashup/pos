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

  // Pull units
  try {
    const res = await client.get('/units?per_page=500&status=active')
    const units = res.data?.data ?? res.data ?? []
    for (const u of units) {
      UnitRepository.upsert(u)
      pulled++
    }
  } catch (e: unknown) {
    errors.push(`units: ${(e as Error).message}`)
  }

  // Pull item groups
  try {
    const res = await client.get('/item-groups?per_page=500')
    const groups = res.data?.data ?? res.data ?? []
    for (const g of groups) {
      ItemRepository.upsertGroup(g)
      pulled++
    }
  } catch (e: unknown) {
    errors.push(`item-groups: ${(e as Error).message}`)
  }

  // Pull items
  try {
    let page = 1
    while (true) {
      const res = await client.get(`/items?per_page=200&page=${page}&is_active=true`)
      const payload = res.data
      const records: unknown[] = payload.data ?? payload ?? []
      if (records.length === 0) break
      for (const item of records) {
        ItemRepository.upsert(item as Parameters<typeof ItemRepository.upsert>[0])
        pulled++
      }
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) {
    errors.push(`items: ${(e as Error).message}`)
  }

  // Pull item media (images)
  try {
    const db = getDb()
    const upsertMedia = db.prepare(
      `INSERT OR REPLACE INTO media (id, company_id, entity_type, entity_id, url, sort_order, is_primary, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    let page = 1
    while (true) {
      const res = await client.get(`/media?entity_type=item&per_page=200&page=${page}`)
      const payload = res.data
      const records: unknown[] = payload.data ?? payload ?? []
      if (records.length === 0) break
      for (const m of records as any[]) {
        upsertMedia.run(m.id, m.company_id ?? null, 'item', m.entity_id, m.url, m.sort_order ?? 0, m.is_primary ? 1 : 0)
        pulled++
      }
      if (!payload.next_page_url) break
      page++
    }
  } catch (e: unknown) {
    errors.push(`media: ${(e as Error).message}`)
  }

  // Pull floor plans
  try {
    const res = await client.get('/floor-plans')
    const plans = res.data?.data ?? []
    for (const fp of plans) {
      TableRepository.upsertFloorPlan(fp)
      pulled++
    }
  } catch (e: unknown) {
    errors.push(`floor-plans: ${(e as Error).message}`)
  }

  // Pull dining tables
  try {
    const res = await client.get('/dining-tables?is_active=1')
    const tables = res.data?.data ?? []
    for (const t of tables) {
      TableRepository.upsert(t)
      pulled++
    }
  } catch (e: unknown) {
    errors.push(`dining-tables: ${(e as Error).message}`)
  }

  // Pull godowns
  try {
    const res = await client.get('/godowns')
    const godowns = res.data?.data ?? []
    const db = getDb()
    for (const g of godowns) {
      db.prepare(
        `INSERT OR REPLACE INTO godowns (id, company_id, name, is_default, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
      ).run(g.id, g.company_id, g.name, g.is_default ? 1 : 0)
      pulled++
    }
  } catch (e: unknown) {
    errors.push(`godowns: ${(e as Error).message}`)
  }

  return { pulled, errors }
}
