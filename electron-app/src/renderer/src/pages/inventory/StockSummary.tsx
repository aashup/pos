import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, AlertTriangle, RefreshCw } from 'lucide-react'
import { inventoryApi } from '../../api/inventory'
import { cn } from '../../lib/utils'

interface StockItem {
  id: string
  name: string
  unit: string
  current_stock: number
  min_stock_alert: number | null
  purchase_price: number | null
  godown_name?: string
}

export default function StockSummary() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showLow, setShowLow] = useState(false)

  const { data: items = [], isLoading, refetch, isFetching } = useQuery<StockItem[]>({
    queryKey: ['stock-summary'],
    queryFn: async () => {
      const res = await inventoryApi.summary()
      return res.data?.data ?? []
    },
  })

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchLow    = !showLow || (item.min_stock_alert != null && item.current_stock <= item.min_stock_alert)
    return matchSearch && matchLow
  })

  const lowStockCount = items.filter(
    (i) => i.min_stock_alert != null && i.current_stock <= i.min_stock_alert,
  ).length

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Stock Summary</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
        </button>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="bg-white border-b border-gray-100 p-3 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLow((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                showLow
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock {lowStockCount > 0 && `(${lowStockCount})`}
            </button>
            <span className="text-xs text-gray-400">{filtered.length} items</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No items found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Item</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Stock</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Unit</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => {
                  const isLow = item.min_stock_alert != null && item.current_stock <= item.min_stock_alert
                  const isOut = item.current_stock <= 0
                  return (
                    <tr key={item.id} className={cn('hover:bg-gray-50', isOut && 'bg-red-50')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <span className={cn('font-medium', isLow ? 'text-red-700' : 'text-gray-800')}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-800')}>
                        {Number(item.current_stock).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">
                        {item.min_stock_alert != null ? item.min_stock_alert : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
