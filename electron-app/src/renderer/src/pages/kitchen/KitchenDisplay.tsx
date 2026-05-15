import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Clock, ChefHat, Loader2, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { kotsApi } from '../../api/kots'
import { ipc, type LocalKot } from '../../bridge/ipc'
import { useKotsStore } from '../../store/kotsStore'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { KOTLine } from '../../types'

type KotStatus = 'new' | 'in_progress' | 'ready'

const getColumns = (isDark: boolean): { key: KotStatus; label: string; bg: string; headerBg: string }[] => [
  { key: 'new',         label: 'New',     bg: isDark ? 'bg-red-950' : 'bg-red-50',      headerBg: 'bg-red-500' },
  { key: 'in_progress', label: 'Cooking', bg: isDark ? 'bg-orange-950' : 'bg-orange-50', headerBg: 'bg-orange-500' },
  { key: 'ready',       label: 'Ready',   bg: isDark ? 'bg-green-950' : 'bg-green-50',  headerBg: 'bg-green-600' },
]

export default function KitchenDisplay() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [now, setNow] = useState(() => Date.now())
  const [isOnline, setIsOnline] = useState(true)
  const syncingRef = useRef(false)

  const { kots, isLoaded, loadKots, updateKotStatus, updateLineStatus } = useKotsStore()

  // Seed on mount
  useEffect(() => { loadKots() }, [])

  // Tick every 30s to refresh elapsed timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Background API sync every 30s — picks up KOTs from the main window / other devices
  useEffect(() => {
    const syncFromApi = async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        const res = await kotsApi.list({ status: 'new,in_progress,ready' })
        const serverKots: unknown[] = res.data?.data ?? []
        await Promise.all(serverKots.map((k) => ipc.kots.upsertFromServer(k)))
        setIsOnline(true)
        // Reload from SQLite after upsert so the store reflects server state
        await loadKots()
      } catch {
        setIsOnline(false)
      } finally {
        syncingRef.current = false
      }
    }

    syncFromApi()
    const id = setInterval(syncFromApi, 30_000)
    return () => clearInterval(id)
  }, [])

  // KOT status advance: SQLite write + optimistic Zustand update
  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'in_progress' | 'ready' | 'served' }) =>
      ipc.kots.updateStatus(id, status),
    onSuccess: (_, { id, status }) => updateKotStatus(id, status),
    onError: () => toast.error('Failed to update status'),
  })

  // Line status toggle: SQLite write + optimistic Zustand update
  const lineMutation = useMutation({
    mutationFn: ({ kotId, lineId, status }: { kotId: string; lineId: string; status: 'cooking' | 'ready' }) =>
      ipc.kots.updateLineStatus(kotId, lineId, status),
    onSuccess: (_, { kotId, lineId, status }) => updateLineStatus(kotId, lineId, status),
    onError: () => toast.error('Failed to update item'),
  })

  const kotsByStatus = (status: KotStatus) =>
    kots
      .filter((k) => k.status === status)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-orange-400" />
          <span className="font-bold text-orange-400">Kitchen Display</span>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <WifiOff className="w-3.5 h-3.5" />
              Offline
            </span>
          )}
          <span className="text-xs text-gray-400">
            {kots.length} active order{kots.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Columns */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {getColumns(isDark).map((col) => {
          const cards = kotsByStatus(col.key)
          return (
            <div key={col.key} className="flex-1 flex flex-col min-w-0">
              <div className={cn('rounded-t-xl px-3 py-2 flex items-center justify-between shrink-0', col.headerBg)}>
                <span className="font-bold text-sm">{col.label}</span>
                <span className="bg-white/20 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {cards.length}
                </span>
              </div>

              <div className={cn('flex-1 overflow-y-auto rounded-b-xl p-2 space-y-2', col.bg)}>
                {cards.length === 0 ? (
                  <div className={cn('flex items-center justify-center h-20 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Nothing here
                  </div>
                ) : (
                  cards.map((kot) => (
                    <KOTCard
                      key={kot.id}
                      kot={kot}
                      now={now}
                      onAdvance={(status) => advanceMutation.mutate({ id: kot.id, status })}
                      onLineToggle={(lineId, status) =>
                        lineMutation.mutate({ kotId: kot.id, lineId, status })
                      }
                      advancing={advanceMutation.isPending}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface KOTCardProps {
  kot: LocalKot
  now: number
  onAdvance: (status: 'in_progress' | 'ready' | 'served') => void
  onLineToggle: (lineId: string, status: 'cooking' | 'ready') => void
  advancing: boolean
  isDark: boolean
}

function KOTCard({ kot, now, onAdvance, onLineToggle, advancing, isDark }: KOTCardProps) {
  const elapsedMin = kot.created_at
    ? Math.max(0, Math.floor((now - new Date(kot.created_at).getTime()) / 60_000))
    : 0

  const nextStatus: Record<string, 'in_progress' | 'ready' | 'served'> = {
    new: 'in_progress',
    in_progress: 'ready',
    ready: 'served',
  }
  const nextLabel: Record<string, string> = {
    new: 'Start Cooking',
    in_progress: 'Mark Ready',
    ready: 'Mark Served',
  }

  const next = nextStatus[kot.status]
  const nextLbl = nextLabel[kot.status]
  const isOverdue = elapsedMin >= 15

  return (
    <div className={cn('rounded-xl shadow-sm overflow-hidden border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
      <div className={cn('flex items-center justify-between px-3 py-2 border-b', isDark ? 'border-gray-700' : 'border-gray-100')}>
        <div>
          <span className={cn('font-bold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
            #{kot.kot_number}
          </span>
          {kot.notes && <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{kot.notes}</p>}
        </div>
        <div className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-400' : isDark ? 'text-gray-400' : 'text-gray-500')}>
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{elapsedMin}m</span>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {(kot.lines ?? []).map((line) => (
          <KOTLineRow
            key={line.id}
            line={line as KOTLine}
            onToggle={(status) => onLineToggle(line.id, status)}
            isDark={isDark}
          />
        ))}
      </div>

      {next && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onAdvance(next)}
            disabled={advancing}
            className={cn(
              'w-full py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5',
              next === 'in_progress' && 'bg-orange-500 hover:bg-orange-600 text-white',
              next === 'ready'       && 'bg-green-500 hover:bg-green-600 text-white',
              next === 'served'      && 'bg-gray-500 hover:bg-gray-600 text-white',
              advancing && 'opacity-50',
            )}
          >
            {next === 'ready' && <CheckCircle className="w-3.5 h-3.5" />}
            {nextLbl}
          </button>
        </div>
      )}
    </div>
  )
}

function KOTLineRow({
  line,
  onToggle,
  isDark,
}: {
  line: KOTLine
  onToggle: (status: 'cooking' | 'ready') => void
  isDark: boolean
}) {
  const isDone = line.status === 'ready'
  const isCooking = line.status === 'cooking'

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors',
        isDone
          ? (isDark ? 'bg-green-900 opacity-60' : 'bg-green-50 opacity-60')
          : isCooking
            ? (isDark ? 'bg-orange-900' : 'bg-orange-50')
            : (isDark ? 'bg-gray-700' : 'bg-gray-50'),
      )}
      onClick={() => onToggle(isDone ? 'cooking' : isCooking ? 'ready' : 'cooking')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            isDone ? 'border-green-500 bg-green-500' : isCooking ? 'border-orange-500' : (isDark ? 'border-gray-500' : 'border-gray-300'),
          )}
        >
          {isDone && <CheckCircle className="w-3 h-3 text-white" />}
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm font-medium truncate', isDone && (isDark ? 'line-through text-gray-500' : 'line-through text-gray-400'))}>
            {line.item_name}
            {line.variant_name && <span className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>({line.variant_name})</span>}
          </p>
          {line.notes && <p className={cn('text-xs truncate', isDark ? 'text-orange-400' : 'text-orange-600')}>{line.notes}</p>}
        </div>
      </div>
      <span className={cn('font-bold text-sm shrink-0', isDark ? 'text-gray-300' : 'text-gray-700')}>×{line.quantity}</span>
    </div>
  )
}
