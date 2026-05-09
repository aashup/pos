import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronRight, LayoutGrid, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { tablesApi } from '../../api/tables'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { FloorPlan, DiningTable } from '../../types'

type Shape = 'square' | 'round' | 'rectangle'

const SHAPE_LABELS: Record<Shape, string> = {
  square: 'Square',
  round: 'Round',
  rectangle: 'Rectangle',
}

export default function TableManager() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null)
  const [floorModal, setFloorModal] = useState<{ open: boolean; floor?: FloorPlan }>({ open: false })
  const [tableModal, setTableModal] = useState<{ open: boolean; table?: DiningTable }>({ open: false })

  const { data: floors = [] } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plans'],
    queryFn: async () => (await tablesApi.floorPlans()).data?.data ?? [],
  })

  const { data: allTables = [] } = useQuery<DiningTable[]>({
    queryKey: ['dining-tables'],
    queryFn: async () => (await tablesApi.tables()).data?.data ?? [],
  })

  const selectedFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0] ?? null
  const floorTables = allTables.filter((t) => t.floor_plan_id === selectedFloor?.id)

  const deleteFloor = useMutation({
    mutationFn: (id: string) => tablesApi.deleteFloorPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['floor-plans'] })
      toast.success('Floor plan deleted')
      setActiveFloorId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot delete floor plan'),
  })

  const deleteTable = useMutation({
    mutationFn: (id: string) => tablesApi.deleteTable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dining-tables'] })
      toast.success('Table deleted')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Cannot delete table'),
  })

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos/billing')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Table Manager</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={cn('w-56 shrink-0 border-r flex flex-col', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className={cn('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>Floor Plans</span>
            <button
              onClick={() => setFloorModal({ open: true })}
              className="w-6 h-6 rounded bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {floors.length === 0 ? (
              <p className={cn('text-xs px-4 py-3', isDark ? 'text-gray-500' : 'text-gray-400')}>No floor plans yet.</p>
            ) : (
              floors.map((floor) => (
                <div
                  key={floor.id}
                  onClick={() => setActiveFloorId(floor.id)}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 cursor-pointer group',
                    (selectedFloor?.id === floor.id)
                      ? isDark
                        ? 'bg-orange-900 border-r-2 border-orange-500'
                        : 'bg-orange-50 border-r-2 border-orange-500'
                      : isDark
                        ? 'hover:bg-gray-800'
                        : 'hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <LayoutGrid className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} />
                    <span className={cn('text-sm truncate', isDark ? 'text-gray-200' : 'text-gray-700')}>{floor.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setFloorModal({ open: true, floor }) }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${floor.name}"?`)) deleteFloor.mutate(floor.id)
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!selectedFloor ? (
            <div className={cn('flex-1 flex items-center justify-center text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
              <div className="text-center">
                <LayoutGrid className={cn('w-10 h-10 mx-auto mb-2 opacity-30', isDark ? 'text-gray-600' : 'text-gray-400')} />
                <p>Select or create a floor plan</p>
              </div>
            </div>
          ) : (
            <>
              <div className={cn('px-6 py-3 border-b flex items-center justify-between shrink-0', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div>
                  <h2 className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{selectedFloor.name}</h2>
                  <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-400')}>{floorTables.length} table{floorTables.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setTableModal({ open: true })}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Table
                </button>
              </div>

              <div className={cn('flex-1 overflow-y-auto p-6', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
                {floorTables.length === 0 ? (
                  <div className={cn('text-center py-16', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    <p className="text-sm">No tables on this floor.</p>
                    <p className="text-xs mt-1">Click "Add Table" to create one.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {floorTables.map((table) => (
                      <TableRow
                        key={table.id}
                        table={table}
                        isDark={isDark}
                        onEdit={() => setTableModal({ open: true, table })}
                        onDelete={() => {
                          if (confirm(`Delete table "${table.name}"?`)) deleteTable.mutate(table.id)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {floorModal.open && (
        <FloorPlanModal
          isDark={isDark}
          floor={floorModal.floor}
          onClose={() => setFloorModal({ open: false })}
          onSaved={(floor) => {
            qc.invalidateQueries({ queryKey: ['floor-plans'] })
            setActiveFloorId(floor.id)
            setFloorModal({ open: false })
          }}
        />
      )}

      {tableModal.open && selectedFloor && (
        <TableModal
          isDark={isDark}
          table={tableModal.table}
          floorPlanId={selectedFloor.id}
          onClose={() => setTableModal({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['dining-tables'] })
            setTableModal({ open: false })
          }}
        />
      )}
    </div>
  )
}

function TableRow({ table, isDark, onEdit, onDelete }: { table: DiningTable; isDark: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={cn('border rounded-xl p-4 flex items-start justify-between group', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
      <div>
        <p className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{table.name}</p>
        <p className={cn('text-xs mt-0.5 capitalize', isDark ? 'text-gray-400' : 'text-gray-400')}>
          {table.shape} · {table.capacity} seats
        </p>
        <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-400')}>
          Position: ({table.pos_x}, {table.pos_y})
        </p>
        {!table.is_active && (
          <span className={cn('mt-1 inline-block text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}>Inactive</span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        <button onClick={onEdit} className={cn('p-1.5 rounded transition-colors', isDark ? 'text-gray-500 hover:text-blue-400 hover:bg-blue-900' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className={cn('p-1.5 rounded transition-colors', isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-900' : 'text-gray-400 hover:text-red-600 hover:bg-red-50')}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function FloorPlanModal({
  isDark,
  floor,
  onClose,
  onSaved,
}: {
  isDark: boolean
  floor?: FloorPlan
  onClose: () => void
  onSaved: (f: FloorPlan) => void
}) {
  const [name, setName] = useState(floor?.name ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = floor
        ? await tablesApi.updateFloorPlan(floor.id, { name: name.trim() })
        : await tablesApi.createFloorPlan({ name: name.trim() })
      toast.success(floor ? 'Floor plan updated' : 'Floor plan created')
      onSaved(res.data.data)
    } catch {
      toast.error('Failed to save floor plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isDark={isDark} title={floor ? 'Edit Floor Plan' : 'New Floor Plan'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-300 bg-white')}
            placeholder="e.g. Ground Floor"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={cn('px-4 py-2 text-sm', isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800')}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TableModal({
  isDark,
  table,
  floorPlanId,
  onClose,
  onSaved,
}: {
  isDark: boolean
  table?: DiningTable
  floorPlanId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(table?.name ?? '')
  const [capacity, setCapacity] = useState(table?.capacity ?? 4)
  const [shape, setShape] = useState<Shape>(table?.shape ?? 'square')
  const [posX, setPosX] = useState(table?.pos_x ?? 10)
  const [posY, setPosY] = useState(table?.pos_y ?? 10)
  const [isActive, setIsActive] = useState(table?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Table name is required'); return }
    setSaving(true)
    try {
      if (table) {
        await tablesApi.updateTable(table.id, { name: name.trim(), capacity, shape, pos_x: posX, pos_y: posY, is_active: isActive })
        toast.success('Table updated')
      } else {
        await tablesApi.createTable({ floor_plan_id: floorPlanId, name: name.trim(), capacity, shape, pos_x: posX, pos_y: posY })
        toast.success('Table created')
      }
      onSaved()
    } catch {
      toast.error('Failed to save table')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isDark={isDark} title={table ? `Edit Table — ${table.name}` : 'Add Table'} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-600')}>Table Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-300 bg-white')}
              placeholder="e.g. T1, Table 1"
            />
          </div>
          <div>
            <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-600')}>Capacity (seats)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-300 bg-white')}
            />
          </div>
        </div>

        <div>
          <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-600')}>Shape</label>
          <div className="flex gap-2">
            {(['square', 'round', 'rectangle'] as Shape[]).map((s) => (
              <button
                key={s}
                onClick={() => setShape(s)}
                className={cn(
                  'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors',
                  shape === s ? 'bg-orange-500 text-white border-orange-500' : isDark ? 'bg-gray-800 text-gray-300 border-gray-700 hover:border-orange-400' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300',
                )}
              >
                {SHAPE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-600')}>
            Position on map
            <span className={cn('font-normal ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>(0–100 coordinate space)</span>
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={cn('block text-xs mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>X (left → right)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-300 bg-white')}
              />
            </div>
            <div className="flex-1">
              <label className={cn('block text-xs mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Y (top → bottom)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-300 bg-white')}
              />
            </div>
          </div>
          <MiniMapPreview isDark={isDark} posX={posX} posY={posY} shape={shape} name={name || '?'} />
        </div>

        {table && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsActive(!isActive)}
              className={cn(
                'w-9 h-5 rounded-full transition-colors relative',
                isActive ? 'bg-green-500' : 'bg-gray-300',
              )}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', isActive ? 'translate-x-4' : 'translate-x-0.5')} />
            </button>
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>{isActive ? 'Active' : 'Inactive'}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={cn('px-4 py-2 text-sm', isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800')}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
          >
            {saving ? 'Saving…' : table ? 'Update' : 'Add Table'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function MiniMapPreview({ isDark, posX, posY, shape, name }: { isDark: boolean; posX: number; posY: number; shape: Shape; name: string }) {
  const W = 280, H = 100
  const cx = 8 + (posX / 100) * (W - 16)
  const cy = 8 + (posY / 100) * (H - 16)

  return (
    <div className={cn('mt-2 rounded-lg border overflow-hidden', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')} style={{ height: H }}>
      <svg width={W} height={H}>
        {[1,2,3,4].map(i => <line key={`v${i}`} x1={W/5*i} y1={0} x2={W/5*i} y2={H} stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth={1} />)}
        {[1,2].map(i => <line key={`h${i}`} x1={0} y1={H/3*i} x2={W} y2={H/3*i} stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth={1} />)}
        {shape === 'round' ? (
          <circle cx={cx} cy={cy} r={12} fill="#fed7aa" stroke="#f97316" strokeWidth={2} />
        ) : (
          <rect
            x={cx - (shape === 'rectangle' ? 20 : 12)} y={cy - 12}
            width={shape === 'rectangle' ? 40 : 24} height={24}
            rx={4} fill="#fed7aa" stroke="#f97316" strokeWidth={2}
          />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill="#9a3412" fontWeight="600">
          {name.slice(0, 4)}
        </text>
      </svg>
    </div>
  )
}

function Modal({ isDark, title, children, onClose }: { isDark: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className={cn('rounded-2xl shadow-xl w-full max-w-md', isDark ? 'bg-gray-900' : 'bg-white')}>
        <div className={cn('flex items-center justify-between px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <h3 className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{title}</h3>
          <button onClick={onClose} className={cn('transition-colors', isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
