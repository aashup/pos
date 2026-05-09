import { BrowserWindow } from 'electron'
import { pullFromServer, type PullResult } from './PullWorker'
import { pushToServer, type PushResult } from './PushWorker'

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
  lastSyncAt: string | null
}

let lastSyncAt: string | null = null
let isSyncing = false

export async function runSync(): Promise<SyncResult> {
  if (isSyncing) return { pushed: 0, pulled: 0, errors: ['Sync already in progress'], lastSyncAt }

  isSyncing = true
  broadcastStatus({ status: 'syncing', lastSyncAt })

  let pushResult: PushResult = { pushed: 0, errors: [] }
  let pullResult: PullResult = { pulled: 0, errors: [] }

  try {
    pushResult = await pushToServer()
    pullResult = await pullFromServer()
    lastSyncAt = new Date().toISOString()
  } catch (e: unknown) {
    pullResult.errors.push(`sync error: ${(e as Error).message}`)
  } finally {
    isSyncing = false
  }

  const result: SyncResult = {
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    errors: [...pushResult.errors, ...pullResult.errors],
    lastSyncAt,
  }

  broadcastStatus({ status: 'idle', lastSyncAt, ...result })

  return result
}

export function getSyncStatus() {
  return { status: isSyncing ? 'syncing' : 'idle', lastSyncAt }
}

function broadcastStatus(status: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('sync:status-changed', status)
  })
}
