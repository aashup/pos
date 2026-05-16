import { useState, useRef, useMemo, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ipc } from '../../bridge/ipc'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useCartStore } from '../../store/cartStore'
import { cn } from '../../lib/utils'
import type { Item, ItemGroup } from '../../types'

export interface POSItem extends Item {
  selling_price: number
  image_url?: string | null
  has_variants: number
  has_modifiers: number
}

interface Props {
  onItemAdd?: (item: POSItem) => void
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

export default function ItemGrid({ onItemAdd }: Props = {}) {
  const addItem = useCartStore((s) => s.addItem)

  const handleAdd = (item: POSItem) => {
    if (onItemAdd) {
      onItemAdd(item)
    } else {
      addItem({ ...item, selling_price: item.selling_price ?? 0 })
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

  // Client-side filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allItems.filter((item) => {
      const matchesGroup = !selectedGroup || item.item_group_id === selectedGroup
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku ?? '').toLowerCase().includes(q)
      return matchesGroup && matchesSearch
    })
  }, [allItems, search, selectedGroup])

  // Populate module-level cache; update entry if URL changed (e.g. image downloaded since last fetch)
  useEffect(() => {
    for (const item of allItems) {
      const cached = imageUrlCache.get(item.id)
      if (cached === undefined || (item.image_url && cached !== item.image_url)) {
        imageUrlCache.set(item.id, item.image_url ?? null)
      }
    }
  }, [allItems])

  // F2 focuses search — registered via global shortcut stack so conflicts resolve correctly
  const f2Shortcut = useMemo(() => [
    { key: 'F2', label: 'Focus item search', action: () => searchRef.current?.focus() },
  ], [])
  useKeyboardShortcuts(f2Shortcut)

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

      {/* Category tabs */}
      {groups.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-100 dark:border-gray-700 shrink-0 scrollbar-none">
          <button
            onClick={() => setSelectedGroup(undefined)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              !selectedGroup
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            )}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(selectedGroup === g.id ? undefined : g.id)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedGroup === g.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600">
            <span className="text-2xl mb-2">🍽️</span>
            <span className="text-sm">{search || selectedGroup ? 'No items found' : 'No items synced yet'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ItemCard({ item, onAdd }: { item: POSItem; onAdd: () => void }) {
  const color = colorFor(item.name)
  const initials = item.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const resolvedImageUrl = imageUrlCache.get(item.id) ?? item.image_url ?? null

  return (
    <button
      onClick={onAdd}
      className="group flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-md active:scale-95 transition-all text-left"
    >
      {/* Image / placeholder */}
      <div className="relative w-full aspect-square overflow-hidden">
        {resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            onError={(e) => {
              // On image load error fall back to placeholder
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
            resolvedImageUrl ? 'hidden' : 'flex',
          )}
        >
          {initials}
        </div>
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
