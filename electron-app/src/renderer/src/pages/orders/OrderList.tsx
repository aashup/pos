import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, RefreshCw } from 'lucide-react'
import { ordersApi } from '../../api/orders'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'
import type { SalesInvoice } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
}

const TABS = [
  { key: '',          label: 'Active' },
  { key: 'confirmed', label: 'Paid Today' },
  { key: 'all',       label: 'All' },
]

export default function OrderList() {
  const navigate = useNavigate()
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
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
      <div className="bg-white border-b border-gray-100 flex px-4 gap-1 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No orders found</div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/pos/orders/${order.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">
                    {order.invoice_number ?? `Draft #${order.id.slice(-6)}`}
                  </span>
                  {order.pos_held && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                      Held
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {order.order_type.replace('_', ' ')}
                  {order.dining_table ? ` · Table ${order.dining_table.name}` : ''}
                  {' · '}
                  {order.lines?.length ?? 0} items
                </p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <p className="font-bold text-gray-800">{formatCurrency(order.grand_total)}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600')}>
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
