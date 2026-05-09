import { net } from 'electron'
import { runSync } from './SyncEngine'

const FOREGROUND_INTERVAL = 30_000  // 30s
const BACKGROUND_INTERVAL = 300_000 // 5min

let timer: ReturnType<typeof setInterval> | null = null
let inBackground = false

export const SyncScheduler = {
  start(): void {
    this.scheduleNext()

    // Sync immediately on network reconnect
    net.on?.('online' as Parameters<typeof net.on>[0], () => {
      void runSync()
    })
  },

  scheduleNext(): void {
    if (timer) clearInterval(timer)
    const interval = inBackground ? BACKGROUND_INTERVAL : FOREGROUND_INTERVAL
    timer = setInterval(() => void runSync(), interval)
  },

  setBackground(bg: boolean): void {
    if (inBackground !== bg) {
      inBackground = bg
      this.scheduleNext()
    }
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
