import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Clock, ChefHat, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { kotsApi } from '../../api/kots'
import { cn, elapsedMinutes } from '../../lib/utils'
import type { KOT, KOTLine } from '../../types'

type KotStatus = 'new' | 'in_progress' | 'ready'

const COLUMNS: { key: KotStatus; label: string; bg: string; headerBg: string }[] = [
  { key: 'new',         label: 'New',         bg: 'bg-red-50',    headerBg: 'bg-red-500' },
  { key: 'in_progress', label: 'Cooking',      bg: 'bg-orange-50', headerBg: 'bg-orange-500' },
  { key: 'ready',       label: 'Ready',        bg: 'bg-green-50',  headerBg: 'bg-green-600' },
]

export default function KitchenDisplay() {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  // tick every 30s to refresh elapsed timers
  useState(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  })

  const { data: kots = [], isLoading } = useQuery<KOT[]>({
    queryKey: ['kitchen-kots'],
    queryFn: async () => {
      const res = await kotsApi.list({ status: 'new,in_progress,ready' })
      return res.data?.data ?? []
    },
    refetchInterval: 10_000,
  })

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'in_progress' | 'ready' | 'served' }) =>
      kotsApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-kots'] }),
    onError: () => toast.error('Failed to update status'),
  })

  const lineMutation = useMutation({
    mutationFn: ({ kotId, lineId, status }: { kotId: string; lineId: string; status: 'cooking' | 'ready' }) =>
      kotsApi.updateLineStatus(kotId, lineId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-kots'] }),
    onError: () => toast.error('Failed to update item'),
  })

  const kotsByStatus = (status: KotStatus) =>
    kots
      .filter((k) => k.status === status)
      .sort((a, b) => a.kot_number.localeCompare(b.kot_number))

  if (isLoading) {
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
        <span className="text-xs text-gray-400">
          {kots.length} active order{kots.length !== 1 ? 's' : ''}
        </span>
      </header>

      {/* Columns */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {COLUMNS.map((col) => {
          const cards = kotsByStatus(col.key)
          return (
            <div key={col.key} className="flex-1 flex flex-col min-w-0">
              {/* Column header */}
              <div className={cn('rounded-t-xl px-3 py-2 flex items-center justify-between shrink-0', col.headerBg)}>
                <span className="font-bold text-sm">{col.label}</span>
                <span className="bg-white/20 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {cards.length}
                </span>
              </div>

              {/* KOT cards */}
              <div className={cn('flex-1 overflow-y-auto rounded-b-xl p-2 space-y-2', col.bg)}>
                {cards.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-gray-400 text-xs">
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
  kot: KOT
  now: number
  onAdvance: (status: 'in_progress' | 'ready' | 'served') => void
  onLineToggle: (lineId: string, status: 'cooking' | 'ready') => void
  advancing: boolean
}

function KOTCard({ kot, now, onAdvance, onLineToggle, advancing }: KOTCardProps) {
  const elapsed = kot.kot_number
    ? Math.floor((now - new Date(kot.kot_number.split('-')[2] ?? '').getTime()) / 60_000)
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

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      {/* KOT header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div>
          <span className="font-bold text-gray-800 text-sm">KOT #{kot.kot_number}</span>
          {kot.notes && <p className="text-xs text-gray-400">{kot.notes}</p>}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <ElapsedBadge kotId={kot.id} />
        </div>
      </div>

      {/* Lines */}
      <div className="px-3 py-2 space-y-1.5">
        {(kot.lines ?? []).map((line) => (
          <KOTLineRow
            key={line.id}
            line={line}
            onToggle={(status) => onLineToggle(line.id, status)}
          />
        ))}
      </div>

      {/* Action button */}
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

function ElapsedBadge({ kotId }: { kotId: string }) {
  // Simple display — just show how many minutes since creation
  // In a real build, KOT would carry created_at
  return <span className="tabular-nums">{kotId.slice(-2)}m</span>
}

function KOTLineRow({
  line,
  onToggle,
}: {
  line: KOTLine
  onToggle: (status: 'cooking' | 'ready') => void
}) {
  const isDone = line.status === 'ready'
  const isCooking = line.status === 'cooking'

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors',
        isDone   ? 'bg-green-50 opacity-60' : isCooking ? 'bg-orange-50' : 'bg-gray-50',
      )}
      onClick={() => onToggle(isDone ? 'cooking' : isCooking ? 'ready' : 'cooking')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            isDone ? 'border-green-500 bg-green-500' : isCooking ? 'border-orange-500' : 'border-gray-300',
          )}
        >
          {isDone && <CheckCircle className="w-3 h-3 text-white" />}
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm font-medium truncate', isDone && 'line-through text-gray-400')}>
            {line.item_name}
            {line.variant_name && <span className="text-xs text-gray-400 ml-1">({line.variant_name})</span>}
          </p>
          {line.notes && <p className="text-xs text-orange-600 truncate">{line.notes}</p>}
        </div>
      </div>
      <span className="font-bold text-gray-700 text-sm shrink-0">×{line.quantity}</span>
    </div>
  )
}
