import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, RefreshCw } from 'lucide-react'
import { ordersApi } from '../../api/orders'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'
import type { SalesInvoice } from '../../types'

const getStatusColors = (isDark: boolean): Record<string, string> => ({
  draft:     isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700',
  confirmed: isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700',
  cancelled: isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-500',
})

const TABS = [
  { key: '',          label: 'Active' },
  { key: 'confirmed', label: 'Paid Today' },
  { key: 'all',       label: 'All' },
]

export default function OrderList() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [tab, setTab]       = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders-list', tab],
    queryFn: async () => {
      const params = tab === 'all' ? { per_page: 100 } : tab ? { status: tab, per_page: 100 } : { per_page: 100 }
      const res = await ordersApi.list(params as Parameters<typeof ordersApi.list>[0])
      return (res.data?.data ?? res.data?.data ?? []) as SalesInvoice[]
    },
    refetchInterval: 30_000,
  })

  const orders = (data ?? []).filter((o) => {
    if (!search) return true
    return (
      o.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).toLowerCase().includes(search.toLowerCase())
    )
  })

  const statusColors = getStatusColors(isDark)

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos/billing')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Orders</span>
        </div>
        <button onClick={() => refetch()} className="text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Tabs */}
      <div className={cn('flex px-4 gap-1 shrink-0 border-b', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-orange-500 text-orange-500' : isDark ? 'border-transparent text-gray-400 hover:text-gray-300' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={cn('px-4 py-2 border-b shrink-0', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number..."
            className={cn('w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border', isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500')}
          />
        </div>
      </div>

      {/* List */}
      <div className={cn('flex-1 overflow-y-auto divide-y', isDark ? 'bg-gray-900 divide-gray-800' : 'divide-gray-100')}>
        {isLoading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
        ) : orders.length === 0 ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>No orders found</div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/pos/orders/${order.id}`)}
              className={cn('w-full flex items-center justify-between px-4 py-3 transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {order.invoice_number ?? `Draft #${order.id.slice(-6)}`}
                  </span>
                  {order.pos_held && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-700')}>
                      Held
                    </span>
                  )}
                </div>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {order.order_type.replace('_', ' ')}
                  {order.dining_table ? ` · Table ${order.dining_table.name}` : ''}
                  {' · '}
                  {order.lines?.length ?? 0} items
                </p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <p className={cn('font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(order.grand_total)}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[order.status] ?? (isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'))}>
                  {order.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
