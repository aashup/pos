import { useState, useRef, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ipc } from '../../bridge/ipc'
import type { POSCombo } from '../../bridge/ipc'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useResizable } from '../../hooks/useResizable'
import { useCartStore } from '../../store/cartStore'
import { cn } from '../../lib/utils'
import type { Item, ItemGroup } from '../../types'
import GridDisplaySelection from './GridDisplaySelection'
import type { GridDisplayItem } from './GridDisplaySelection'

export type { POSCombo }

export interface POSItem extends Item {
  selling_price: number
  image_url?: string | null
  image_urls_json?: string | null   // JSON array of all image URLs, ordered by is_primary DESC
  has_variants: number
  has_modifiers: number
}

interface Props {
  onItemAdd?: (item: POSItem) => void
  onComboAdd?: (combo: POSCombo) => void
}

// Module-level cache — survives React Query re-fetches for the lifetime of the renderer process
const imageUrlCache = new Map<string, string | null>()

// Deterministic pastel background per item name (for placeholder)
const CARD_COLORS = [
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-lime-100 text-lime-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-rose-100 text-rose-700',
]

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CARD_COLORS[h % CARD_COLORS.length]
}

const COMBOS_GROUP_ID = '__combos__'

export default function ItemGrid({ onItemAdd, onComboAdd }: Props = {}) {
  const addItem = useCartStore((s) => s.addItem)
  const addCombo = useCartStore((s) => s.addCombo)

  const handleAdd = (item: POSItem) => {
    if (onItemAdd) {
      onItemAdd(item)
    } else {
      addItem({ ...item, selling_price: item.selling_price ?? 0 })
    }
  }

  const handleAddComboCard = (combo: POSCombo) => {
    if (onComboAdd) {
      onComboAdd(combo)
    } else {
      addCombo(combo, [])
    }
  }

  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load all items (max 500) from SQLite once — includes image_url via subquery
  const { data: allItems = [], isLoading } = useQuery<POSItem[]>({
    queryKey: ['pos-items-all'],
    queryFn: async () => (await ipc.items.getAll()) as POSItem[],
    staleTime: 30_000,
  })

  // Load item groups from SQLite
  const { data: groups = [] } = useQuery<ItemGroup[]>({
    queryKey: ['item-groups-local'],
    queryFn: async () => (await ipc.items.getGroups()) as ItemGroup[],
    staleTime: 60_000,
  })

  // Load combos from SQLite
  const { data: allCombos = [] } = useQuery<POSCombo[]>({
    queryKey: ['pos-combos-all'],
    queryFn: () => ipc.combos.getAll(),
    staleTime: 30_000,
  })

  const showingCombos = selectedGroup === COMBOS_GROUP_ID

  // Client-side filter for items
  const filteredItems = useMemo(() => {
    if (showingCombos) return []
    const q = search.trim().toLowerCase()
    return allItems.filter((item) => {
      const matchesGroup = !selectedGroup || item.item_group_id === selectedGroup
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku ?? '').toLowerCase().includes(q)
      return matchesGroup && matchesSearch
    })
  }, [allItems, search, selectedGroup, showingCombos])

  // Client-side filter for combos (search applies when showing combos or __all__)
  const filteredCombos = useMemo(() => {
    if (selectedGroup && !showingCombos) return []
    const q = search.trim().toLowerCase()
    if (!q) return allCombos
    return allCombos.filter((c) => c.name.toLowerCase().includes(q))
  }, [allCombos, search, selectedGroup, showingCombos])

  // Populate module-level cache; update entry if URL changed (e.g. image downloaded since last fetch)
  useEffect(() => {
    for (const item of allItems) {
      const cached = imageUrlCache.get(item.id)
      if (cached === undefined || (item.image_url && cached !== item.image_url)) {
        imageUrlCache.set(item.id, item.image_url ?? null)
      }
    }
  }, [allItems])

  const groupItems: GridDisplayItem[] = useMemo(() => [
    { id: '__all__', label: 'All' },
    ...groups.map((g) => ({ id: g.id, label: g.name })),
    ...(allCombos.length > 0 ? [{ id: COMBOS_GROUP_ID, label: 'Combos' }] : []),
  ], [groups, allCombos])

  const selectedGroupIds = selectedGroup ? [selectedGroup] : ['__all__']

  const { width: groupsWidth, startResize: startGroupsResize } =
    useResizable('pos.layout.groups_width', 112, 80, 220)

  // F2 focuses search — registered via global shortcut stack so conflicts resolve correctly
  const f2Shortcut = useMemo(() => [
    { key: 'F2', label: 'Focus item search', action: () => searchRef.current?.focus() },
  ], [])
  useKeyboardShortcuts(f2Shortcut)

  const isEmpty = showingCombos
    ? filteredCombos.length === 0
    : filteredItems.length === 0 && filteredCombos.length === 0

  return (
    <div className="flex flex-col h-full">

      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items… (F2)"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Body: category sidebar + item grid */}
      <div className="flex flex-1 min-h-0">

        {/* Category sidebar */}
        {groups.length > 0 && (
          <>
            <div
              className="shrink-0 overflow-y-auto border-r border-gray-100 dark:border-gray-700 py-2 px-1.5"
              style={{ width: groupsWidth }}
            >
              <GridDisplaySelection
                items={groupItems}
                selectedIds={selectedGroupIds}
                onChange={(ids) => {
                  const first = ids[0]
                  setSelectedGroup(first === '__all__' || first === undefined ? undefined : String(first))
                }}
                isMultiSelect={false}
                columns={1}
                accentColor="orange"
                ariaLabel="Filter by category"
              />
            </div>
            <div
              className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-orange-400 dark:hover:bg-orange-500 active:bg-orange-500 transition-colors select-none"
              style={{ touchAction: 'none' }}
              onMouseDown={startGroupsResize}
              onTouchStart={startGroupsResize}
            />
          </>
        )}

        {/* Item / Combo grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Loading…
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600">
              <span className="text-2xl mb-2">🍽️</span>
              <span className="text-sm">{search || selectedGroup ? 'No items found' : 'No items synced yet'}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Regular items (hidden when Combos tab selected) */}
              {!showingCombos && filteredItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onAdd={() => handleAdd(item)}
                    />
                  ))}
                </div>
              )}

              {/* Combo section — shown in All view (after items) or when Combos tab selected */}
              {filteredCombos.length > 0 && (
                <div>
                  {!showingCombos && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide">Combos</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {filteredCombos.map((combo) => (
                      <ComboCard
                        key={combo.id}
                        combo={combo}
                        onAdd={() => handleAddComboCard(combo)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function ComboCard({ combo, onAdd }: { combo: POSCombo; onAdd: () => void }) {
  const color = colorFor(combo.name)
  const initials = combo.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <button
      onClick={onAdd}
      className="group flex flex-col rounded-xl overflow-hidden border border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-md active:scale-95 transition-all text-left"
      style={{ minHeight: 56 }}
    >
      {/* Placeholder image area */}
      <div className="relative w-full aspect-square overflow-hidden">
        {combo.image_url ? (
          <img
            src={combo.image_url}
            alt={combo.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              ;(e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex')
            }}
          />
        ) : null}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-xl font-bold',
            color,
            combo.image_url ? 'hidden' : 'flex',
          )}
        >
          {initials}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-0.5 min-w-0">
        <p className="font-medium text-xs text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">
          {combo.name}
        </p>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-teal-600 dark:text-teal-400 font-bold text-sm leading-none">
            ₹{(combo.price ?? 0).toFixed(0)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-medium leading-none">
            COMBO
          </span>
        </div>
        {combo.description && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">
            {combo.description}
          </p>
        )}
      </div>
    </button>
  )
}

function ItemCard({ item, onAdd }: { item: POSItem; onAdd: () => void }) {
  const color = colorFor(item.name)
  const initials = item.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  // Parse all image URLs; fall back to primary cache entry when JSON is absent
  const imageUrls = useMemo<string[]>(() => {
    try {
      const arr: unknown = JSON.parse(item.image_urls_json ?? 'null')
      if (Array.isArray(arr)) {
        const valid = (arr as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
        if (valid.length > 0) return valid
      }
    } catch { /* fall through */ }
    const fallback = imageUrlCache.get(item.id) ?? item.image_url ?? null
    return fallback ? [fallback] : []
  }, [item.image_urls_json, item.image_url, item.id])

  const [slideIdx, setSlideIdx] = useState(0)
  const [fading, setFading] = useState(false)

  // Reset slide index when the item's images change (e.g. after a sync)
  useEffect(() => {
    setSlideIdx(0)
  }, [imageUrls.length])

  // Auto-advance every 3 s with a 200 ms cross-fade
  useEffect(() => {
    if (imageUrls.length <= 1) return
    let timeoutId: ReturnType<typeof setTimeout>
    const intervalId = setInterval(() => {
      setFading(true)
      timeoutId = setTimeout(() => {
        setSlideIdx((i) => (i + 1) % imageUrls.length)
        setFading(false)
      }, 200)
    }, 3000)
    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [imageUrls.length])

  const currentUrl = imageUrls[slideIdx] ?? null

  return (
    <button
      onClick={onAdd}
      className="group flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-md active:scale-95 transition-all text-left"
    >
      {/* Image / placeholder */}
      <div className="relative w-full aspect-square overflow-hidden">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={item.name}
            className={cn(
              'w-full h-full object-cover group-hover:scale-105 transition-all duration-200',
              fading ? 'opacity-0' : 'opacity-100',
            )}
            loading="lazy"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              ;(e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex')
            }}
          />
        ) : null}
        {/* Placeholder — shown when no URL or image fails to load */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center text-xl font-bold',
            color,
            currentUrl ? 'hidden' : 'flex',
          )}
        >
          {initials}
        </div>

        {/* Slide dots — only shown when there are multiple images */}
        {imageUrls.length > 1 && (
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 pointer-events-none">
            {imageUrls.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors duration-200',
                  i === slideIdx ? 'bg-white' : 'bg-white/40',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-0.5 min-w-0">
        <p className="font-medium text-xs text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">
          {item.name}
        </p>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-orange-600 dark:text-orange-400 font-bold text-sm leading-none">
            ₹{(item.selling_price ?? 0).toFixed(0)}
          </span>
          {item.unit && (
            <span className="text-xs text-gray-400 dark:text-gray-500 leading-none truncate">
              {item.unit}
            </span>
          )}
        </div>
        {(item.has_variants > 0 || item.has_modifiers > 0) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {item.has_variants > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium leading-none">
                {item.has_variants}V
              </span>
            )}
            {item.has_modifiers > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium leading-none">
                +ADD
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
