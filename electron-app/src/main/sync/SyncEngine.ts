import { Worker } from 'worker_threads'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { TokenStore } from '../auth/TokenStore'
import { getDbPath } from '../db/database'

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
  lastSyncAt: string | null
}

let lastSyncAt: string | null = null
let isSyncing = false   // simple boolean set synchronously — no race condition possible

export function runSync(): Promise<SyncResult> {
  // Hard gate — set synchronously before any async work so two callers can never both pass
  if (isSyncing) {
    return Promise.resolve({ pushed: 0, pulled: 0, errors: ['Sync already in progress'], lastSyncAt })
  }
  isSyncing = true      // lock immediately

  const token = TokenStore.getToken()
  const serverUrl = TokenStore.getSetting('serverUrl')

  if (!token || !serverUrl) {
    isSyncing = false
    const result: SyncResult = { pushed: 0, pulled: 0, errors: ['Not authenticated'], lastSyncAt }
    broadcastStatus({ status: 'idle', ...result })
    return Promise.resolve(result)
  }

  broadcastStatus({ status: 'syncing', lastSyncAt })

  return new Promise((resolve) => {
    let settled = false

    function finish(result: SyncResult) {
      if (settled) return   // guard against message + exit both firing
      settled = true
      isSyncing = false     // always release lock
      broadcastStatus({ status: result.errors.length ? 'error' : 'idle', ...result })
      resolve(result)
    }

    const workerPath = join(__dirname, 'SyncWorker.js')
    const worker = new Worker(workerPath, {
      workerData: { dbPath: getDbPath(), token, serverUrl },
    })

    worker.on('message', (data: { pushed: number; pulled: number; errors: string[] }) => {
      lastSyncAt = new Date().toISOString()
      finish({ ...data, lastSyncAt })
    })

    worker.on('error', (err) => {
      finish({ pushed: 0, pulled: 0, errors: [`Worker error: ${err.message}`], lastSyncAt })
    })

    worker.on('exit', (code) => {
      // Always release lock on exit, regardless of code
      // finish() is a no-op if message already fired
      if (code !== 0) {
        finish({ pushed: 0, pulled: 0, errors: [`Worker exited with code ${code}`], lastSyncAt })
      } else {
        // Normal exit — just make sure lock is released if message never fired
        if (!settled) {
          settled = true
          isSyncing = false
        }
      }
    })
  })
}

export function getSyncStatus() {
  return { status: isSyncing ? 'syncing' : 'idle', lastSyncAt }
}

function broadcastStatus(status: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('sync:status-changed', status)
  })
}
