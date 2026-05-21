import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, RefreshCw, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { itemsApi } from '../../api/items'
import { ipc } from '../../bridge/ipc'
import type { Item } from '../../types'
import Header from '../../components/layout/Header'

export default function ItemList() {
  const navigate = useNavigate()
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <Header
        title="Items"
        onBack={() => navigate('/pos/billing')}
        actions={[
          { icon: RefreshCw, label: '', onClick: () => refetch() },
          { icon: Settings, label: 'Modifiers', onClick: () => navigate('/inventory/modifiers') },
          { icon: Plus, label: 'Combos', onClick: () => navigate('/inventory/combos') },
          { icon: Plus, label: 'New Item', onClick: () => navigate('/inventory/items/new'), className: 'bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600' },
        ]}
      />

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400 dark:text-gray-500">
            Loading…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400 dark:text-gray-500">
            No items found
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                  {item.name}
                </p>
                <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
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
