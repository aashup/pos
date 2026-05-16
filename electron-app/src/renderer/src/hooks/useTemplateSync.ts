import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useSyncStore } from '../store/syncStore'
import { ipc } from '../bridge/ipc'
import type { LocalPrintTemplate } from '../bridge/ipc'

interface TemplateSyncResult {
  isReady: boolean
  syncError: string | null
  triggerSync: () => void
}

function mapBackendTemplate(t: Record<string, unknown>): LocalPrintTemplate {
  return {
    id:          t.id as string,
    type:        ((t.template_type ?? 'invoice') as string) as LocalPrintTemplate['type'],
    name:        t.name as string,
    layout:      t.html_content as string,
    is_active:   t.is_default ? 1 : 0,
    server_id:   t.id as string,
    sync_status: 'synced',
    updated_at:  (t.updated_at as string | null) ?? null,
    created_at:  t.created_at as string,
  }
}

async function fetchTemplatesFromApi(
  serverUrl: string,
  token: string,
): Promise<LocalPrintTemplate[]> {
  const res = await fetch(`${serverUrl}/api/v1/thermal-templates?per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const raw: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? [])
  return raw.map(mapBackendTemplate)
}

export function useTemplateSync(): TemplateSyncResult {
  const serverUrl        = useAuthStore((s) => s.serverUrl)
  const token            = useAuthStore((s) => s.token)
  const syncStatus       = useSyncStore((s) => s.status)
  const prevSyncStatus   = useRef(syncStatus)

  const [isReady, setIsReady]     = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function doSync(): Promise<void> {
    if (!serverUrl || !token) {
      setIsReady(true)
      return
    }

    if (!navigator.onLine) {
      // Offline — SQLite cache (or hardcoded defaults in usePrinter) will be used
      setIsReady(true)
      return
    }

    try {
      const templates = await fetchTemplatesFromApi(serverUrl, token)
      if (templates.length > 0) {
        await ipc.templates.bulkUpsert(templates)
      }
      setSyncError(null)
    } catch (err) {
      // Non-fatal: the app continues with whatever is in SQLite
      setSyncError(String(err))
    } finally {
      setIsReady(true)
    }
  }

  // Sync on mount
  useEffect(() => {
    doSync()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync whenever the main SyncEngine finishes a full sync cycle
  useEffect(() => {
    if (prevSyncStatus.current === 'syncing' && syncStatus === 'idle') {
      doSync()
    }
    prevSyncStatus.current = syncStatus
  }, [syncStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isReady, syncError, triggerSync: doSync }
}
