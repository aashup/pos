import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users, RefreshCw, LayoutGrid, Map } from 'lucide-react'
import toast from 'react-hot-toast'
import { tablesApi } from '../../api/tables'
import { useCartStore } from '../../store/cartStore'
import { ipc } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'
import type { FloorPlan, DiningTable, TableStatus } from '../../types'

// Canvas dimensions — tables use a 0–100 coordinate space
const CANVAS_W = 900
const CANVAS_H = 600
// Table sizes in canvas units
const TABLE_SIZE: Record<DiningTable['shape'], { w: number; h: number }> = {
  square:    { w: 70, h: 70 },
  round:     { w: 70, h: 70 },
  rectangle: { w: 100, h: 60 },
}

const STATUS_STYLE = (isDark: boolean): Record<TableStatus, { bg: string; border: string; dot: string; label: string }> => ({
  vacant:   { bg: isDark ? '#064e3b' : '#f0fdf4', border: isDark ? '#10b981' : '#86efac', dot: '#4ade80', label: 'Vacant' },
  occupied: { bg: isDark ? '#4c0519' : '#fef2f2', border: isDark ? '#f87171' : '#fca5a5', dot: '#f87171', label: 'Occupied' },
  reserved: { bg: isDark ? '#422006' : '#fefce8', border: isDark ? '#facc15' : '#fde047', dot: '#facc15', label: 'Reserved' },
  cleaning: { bg: isDark ? '#0c2340' : '#eff6ff', border: isDark ? '#60a5fa' : '#93c5fd', dot: '#60a5fa', label: 'Cleaning' },
})

export default function TableSelection() {
  const navigate = useNavigate()
  const { setOrder, setLocalOrder } = useCartStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [activeFloor, setActiveFloor] = useState<string | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [paxMap, setPaxMap] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map')

  const { data: floors = [], isLoading, refetch } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plans'],
    queryFn: async () => {
      const res = await tablesApi.floorPlans()
      return res.data?.data ?? []
    },
  })

  const { data: tables = [], isLoading: tablesLoading } = useQuery<DiningTable[]>({
    queryKey: ['dining-tables'],
    queryFn: async () => {
      const res = await tablesApi.tables()
      return res.data?.data ?? []
    },
    refetchInterval: 15000,
  })

  const activeFloorId = activeFloor ?? floors[0]?.id ?? null
  const visibleTables = tables.filter(
    (t) => t.is_active && (!activeFloorId || t.floor_plan_id === activeFloorId),
  )

  const handleSelectTable = async (table: DiningTable) => {
    if (table.status === 'occupied' && table.current_order_id) {
      // Resume existing server order — no local SQLite order needed
      setOrder(table.current_order_id, 'dine_in', table.id, table.name)
      navigate('/pos/billing')
      return
    }

    if (table.status !== 'vacant') {
      toast.error(`Table ${table.name} is ${table.status}`)
      return
    }

    setSelecting(table.id)
    try {
      const pax = paxMap[table.id] ?? 1
      // Offline-first: create local SQLite order — server push happens in background on KOT/checkout
      const localId = await ipc.order.create({ order_type: 'dine_in', table_id: table.id, pax })
      setLocalOrder(localId, 'dine_in', table.id, table.name)
      navigate('/pos/billing')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to open table: ${msg}`)
    } finally {
      setSelecting(null)
    }
  }

  const loading = isLoading || tablesLoading

  const statusStyle = STATUS_STYLE(isDark)

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-100')}>
      <Header
        title="Table Map"
        onBack={() => navigate('/pos/billing')}
        actions={[
          { icon: viewMode === 'map' ? LayoutGrid : Map, label: viewMode === 'map' ? 'Grid' : 'Map', onClick: () => setViewMode(viewMode === 'map' ? 'grid' : 'map'), className: 'text-xs' },
          { icon: RefreshCw, label: 'Refresh', onClick: () => refetch(), className: 'text-xs' },
        ]}
      />

      {/* Floor plan tabs */}
      {floors.length > 1 && (
        <div className={cn('border-b flex gap-1 px-4 py-2 overflow-x-auto shrink-0', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          {floors.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFloor(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                (activeFloor ?? floors[0]?.id) === f.id
                  ? 'bg-orange-500 text-white'
                  : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className={cn('px-4 py-1.5 flex items-center gap-4 text-xs border-b shrink-0', isDark ? 'text-gray-400 bg-gray-900 border-gray-800' : 'text-gray-500 bg-white border-gray-100')}>
        {Object.entries(statusStyle).map(([status, cfg]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        ))}
        <span className={cn('ml-auto', isDark ? 'text-gray-500' : 'text-gray-400')}>{visibleTables.length} tables</span>
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-auto', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        {loading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
        ) : visibleTables.length === 0 ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            No tables found. Run a sync to load tables.
          </div>
        ) : viewMode === 'map' ? (
          <TableMap
            tables={visibleTables}
            selecting={selecting}
            paxMap={paxMap}
            onPaxChange={(id, v) => setPaxMap((p) => ({ ...p, [id]: v }))}
            onSelect={handleSelectTable}
            isDark={isDark}
            statusStyle={statusStyle}
          />
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {visibleTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                pax={paxMap[table.id] ?? 1}
                onPaxChange={(v) => setPaxMap((p) => ({ ...p, [table.id]: v }))}
                onSelect={() => handleSelectTable(table)}
                loading={selecting === table.id}
                isDark={isDark}
                statusStyle={statusStyle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Map view ────────────────────────────────────────────────────────────────

interface TableMapProps {
  tables: DiningTable[]
  selecting: string | null
  paxMap: Record<string, number>
  onPaxChange: (id: string, v: number) => void
  onSelect: (t: DiningTable) => void
  isDark: boolean
  statusStyle: Record<TableStatus, { bg: string; border: string; dot: string; label: string }>
}

function TableMap({ tables, selecting, paxMap, onPaxChange, onSelect, isDark, statusStyle }: TableMapProps) {
  // Find the actual coordinate range so we can scale properly
  const xs = tables.map((t) => t.pos_x)
  const ys = tables.map((t) => t.pos_y)
  const maxX = Math.max(...xs, 10)
  const maxY = Math.max(...ys, 10)

  // Scale: map 0..maxX → 0..CANVAS_W (with padding)
  const PAD = 60
  const scaleX = (x: number) => PAD + (x / maxX) * (CANVAS_W - PAD * 2)
  const scaleY = (y: number) => PAD + (y / maxY) * (CANVAS_H - PAD * 2)

  return (
    <div className="flex items-start justify-center p-4 min-h-full">
      <div
        className={cn('relative rounded-2xl shadow-sm border overflow-hidden', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
        style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W }}
      >
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          {Array.from({ length: 10 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(CANVAS_W / 10) * i} y1={0}
              x2={(CANVAS_W / 10) * i} y2={CANVAS_H}
              stroke={isDark ? '#4b5563' : '#d1d5db'} strokeWidth={1}
            />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0} y1={(CANVAS_H / 7) * i}
              x2={CANVAS_W} y2={(CANVAS_H / 7) * i}
              stroke={isDark ? '#4b5563' : '#d1d5db'} strokeWidth={1}
            />
          ))}
        </svg>

        {/* Tables */}
        {tables.map((table) => {
          const { w, h } = TABLE_SIZE[table.shape ?? 'square']
          const cx = scaleX(table.pos_x)
          const cy = scaleY(table.pos_y)
          const isClickable = table.status === 'vacant' || table.status === 'occupied'
          const isLoading = selecting === table.id
          const cfg = statusStyle[table.status]
          const pax = paxMap[table.id] ?? 1

          return (
            <div
              key={table.id}
              className={cn(
                'absolute flex flex-col items-center justify-center select-none transition-transform',
                isClickable && !isLoading ? 'cursor-pointer hover:scale-105 active:scale-95' : '',
                !isClickable ? 'opacity-60 cursor-not-allowed' : '',
              )}
              style={{
                left: cx - w / 2,
                top: cy - h / 2,
                width: w,
                height: h,
                background: cfg.bg,
                border: `2px solid ${cfg.border}`,
                borderRadius: table.shape === 'round' ? '50%' : '10px',
              }}
              onClick={isClickable && !isLoading ? () => onSelect(table) : undefined}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <>
                  <span className="font-bold text-gray-800 text-xs leading-tight text-center px-1 truncate w-full text-center">
                    {table.name}
                  </span>
                  <span className="flex items-center gap-0.5 text-gray-400 mt-0.5" style={{ fontSize: 9 }}>
                    <Users style={{ width: 9, height: 9 }} />
                    {table.capacity}
                  </span>
                  {/* Status dot */}
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                    style={{ background: cfg.dot }}
                  />
                  {/* Pax selector for vacant tables — shown as overlay on hover */}
                  {table.status === 'vacant' && (
                    <div
                      className={cn('absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 border rounded-full px-1 py-0.5 shadow-sm z-10', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={cn('w-4 h-4 rounded-full border flex items-center justify-center', isDark ? 'border-gray-500 text-gray-300 hover:bg-gray-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}
                        style={{ fontSize: 10 }}
                        onClick={() => onPaxChange(table.id, Math.max(1, pax - 1))}
                      >–</button>
                      <span className={cn('font-medium', isDark ? 'text-gray-200' : 'text-gray-700')} style={{ fontSize: 10, minWidth: 14, textAlign: 'center' }}>{pax}</span>
                      <button
                        className={cn('w-4 h-4 rounded-full border flex items-center justify-center', isDark ? 'border-gray-500 text-gray-300 hover:bg-gray-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}
                        style={{ fontSize: 10 }}
                        onClick={() => onPaxChange(table.id, Math.min(table.capacity, pax + 1))}
                      >+</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Grid view ───────────────────────────────────────────────────────────────

interface TableCardProps {
  table: DiningTable
  pax: number
  onPaxChange: (v: number) => void
  onSelect: () => void
  loading: boolean
  isDark: boolean
  statusStyle: Record<TableStatus, { bg: string; border: string; dot: string; label: string }>
}

function TableCard({ table, pax, onPaxChange, onSelect, loading, isDark, statusStyle }: TableCardProps) {
  const cfg = statusStyle[table.status]
  const isOccupied = table.status === 'occupied'
  const isVacant = table.status === 'vacant'
  const isClickable = isVacant || isOccupied

  return (
    <button
      onClick={isClickable ? onSelect : undefined}
      disabled={!isClickable || loading}
      className={cn(
        'relative rounded-2xl border-2 p-4 text-left transition-all',
        isClickable ? 'hover:shadow-md cursor-pointer active:scale-95' : 'opacity-60 cursor-not-allowed',
        loading && 'opacity-70',
      )}
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
      <p className={cn('font-bold text-base truncate pr-4', isDark ? 'text-gray-200' : 'text-gray-800')}>{table.name}</p>
      <p className={cn('text-xs mt-0.5 flex items-center gap-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
        <Users className="w-3 h-3" />{table.capacity} seats
      </p>
      <p className={cn('text-xs font-medium mt-2', isDark ? 'text-gray-300' : 'text-gray-600')}>{cfg.label}</p>

      {isVacant && (
        <div className="mt-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <span className={cn('text-xs mr-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Guests:</span>
          <button onClick={() => onPaxChange(Math.max(1, pax - 1))} className={cn('w-5 h-5 rounded border text-xs flex items-center justify-center', isDark ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')}>–</button>
          <span className={cn('text-xs font-semibold w-4 text-center', isDark ? 'text-gray-200' : 'text-gray-700')}>{pax}</span>
          <button onClick={() => onPaxChange(Math.min(table.capacity, pax + 1))} className={cn('w-5 h-5 rounded border text-xs flex items-center justify-center', isDark ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')}>+</button>
        </div>
      )}

      {loading && (
        <div className={cn('absolute inset-0 rounded-2xl flex items-center justify-center', isDark ? 'bg-gray-800/60 text-gray-400' : 'bg-white/60 text-gray-500')}>
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      )}
    </button>
  )
}
