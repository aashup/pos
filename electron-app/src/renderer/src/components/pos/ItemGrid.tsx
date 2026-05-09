import { useState, useEffect, useRef } from 'react'
import { Search, UtensilsCrossed } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ipc } from '../../bridge/ipc'
import { useCartStore } from '../../store/cartStore'
import { cn } from '../../lib/utils'
import type { Item, ItemGroup } from '../../types'

interface POSItem extends Item {
  selling_price: number
}

export default function ItemGrid() {
  const addItem = useCartStore((s) => s.addItem)
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<POSItem[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: groups } = useQuery({
    queryKey: ['item-groups-local'],
    queryFn: async () => {
      const raw = await ipc.items.getGroups()
      return raw as ItemGroup[]
    },
    staleTime: 60_000,
  })

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const raw = await ipc.items.search(search, selectedGroup)
        setItems(raw as POSItem[])
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, selectedGroup])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const gstRate = (item: POSItem) => item.cgst + item.sgst + item.igst

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
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
      {groups && groups.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-100 dark:border-gray-700 shrink-0">
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

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600">
            <UtensilsCrossed className="w-8 h-8 mb-2 opacity-40" />
            <span className="text-sm">{search ? 'No items found' : 'No items synced yet'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem({ ...item, selling_price: item.selling_price ?? 0 })}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-left hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-sm active:scale-95 transition-all"
              >
                <p className="font-medium text-sm text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">{item.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">
                    ₹{(item.selling_price ?? 0).toFixed(0)}
                  </span>
                  {gstRate(item) > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">GST {gstRate(item)}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
