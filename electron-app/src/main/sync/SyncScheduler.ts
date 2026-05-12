import { net } from 'electron'
import { runSync } from './SyncEngine'

const SYNC_INTERVAL = 30 * 60 * 1000  // 30 minutes

let timer: ReturnType<typeof setInterval> | null = null

export const SyncScheduler = {
  start(): void {
    if (timer) return  // already started

    timer = setInterval(() => void runSync(), SYNC_INTERVAL)

    // Also sync immediately when network comes back online
    net.on?.('online' as Parameters<typeof net.on>[0], () => void runSync())
  },

  stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  },

  triggerNow(): Promise<unknown> {
    return runSync()
  },
}
