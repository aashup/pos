import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, Plus, Edit2, Trash2, RefreshCw, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { itemsApi } from '../../api/items'
import { ipc } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, cn } from '../../lib/utils'
import type { Item } from '../../types'

export default function ItemList() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [search, setSearch] = useState('')

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const rows = await ipc.items.getAllInventory()
      return rows as Item[]
    },
    staleTime: 30_000,
  })

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item? This action cannot be undone.')) return
    try {
      await itemsApi.delete(id)
      toast.success('Item deleted')
      refetch()
    } catch {
      toast.error('Failed to delete item')
    }
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos/tables')} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Item Management</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/inventory/modifiers')}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            title="Manage modifier groups"
          >
            <Settings className="w-3.5 h-3.5" />
            Modifiers
          </button>
          <button
            onClick={() => navigate('/inventory/combos')}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            title="Manage combos"
          >
            <Plus className="w-3.5 h-3.5" />
            Combos
          </button>
          <button
            onClick={() => navigate('/inventory/items/new')}
            className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            New Item
          </button>
        </div>
      </header>

      {/* Search */}
      <div className={cn('px-4 py-2 border-b shrink-0', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className={cn(
              'w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
              isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900'
            )}
          />
        </div>
      </div>

      {/* Items List */}
      <div className={cn('flex-1 overflow-y-auto divide-y', isDark ? 'bg-gray-900 divide-gray-800' : 'divide-gray-100')}>
        {isLoading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Loading…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            No items found
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn('flex items-center justify-between px-4 py-3 hover:bg-opacity-50 transition-colors', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
            >
              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
                  {item.name}
                </p>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  SKU: {item.sku || 'N/A'} · {item.unit} · ₹{Number(item.selling_price).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => navigate(`/inventory/items/${item.id}`)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
