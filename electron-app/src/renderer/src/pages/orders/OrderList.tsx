import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw, Printer } from 'lucide-react'
import { ipc } from '../../bridge/ipc'
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { useOrdersStore } from '../../store/ordersStore'
import { formatCurrency } from '../../lib/utils'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'
import GridDisplaySelection from '../../components/pos/GridDisplaySelection'
import type { LocalOrderSummary } from '../../bridge/ipc'

const getStatusColors = (isDark: boolean): Record<string, string> => ({
  draft:     isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700',
  confirmed: isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700',
  cancelled: isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-500',
})

const TAB_ITEMS = [
  { id: 'draft',     label: 'Active' },
  { id: 'confirmed', label: 'Paid Today' },
  { id: 'all',       label: 'All' },
]

export default function OrderList() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const { status: syncStatus } = useSyncStore()
  const isDark = theme === 'dark'
  const [tab, setTab]       = useState('draft')
  const [search, setSearch] = useState('')

  // Active tab — Zustand (no polling)
  const { orders: draftOrders, isLoaded: ordersLoaded, loadOrders } = useOrdersStore()
  useEffect(() => { if (!ordersLoaded) loadOrders() }, [ordersLoaded])

  // Paid Today / All tabs — still query SQLite
  const filters = tab === 'all' ? undefined : tab === 'confirmed' ? { status: 'confirmed', today: true } : undefined
  const { data: queryData, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['orders-list', tab],
    queryFn: () => ipc.order.list(filters as any),
    enabled: tab !== 'draft',
    staleTime: 10_000,
  })

  // On sync complete: reload ordersStore for active tab, refetch for others
  const prevSync = useRef(syncStatus)
  useEffect(() => {
    if (prevSync.current === 'syncing' && syncStatus === 'idle') {
      loadOrders()
      if (tab !== 'draft') refetch()
    }
    prevSync.current = syncStatus
  }, [syncStatus, tab])

  const rawOrders: LocalOrderSummary[] = tab === 'draft' ? draftOrders : (queryData ?? []) as LocalOrderSummary[]
  const isLoading = tab === 'draft' ? !ordersLoaded : queryLoading

  const orders = useMemo(() =>
    rawOrders.filter((o) => {
      if (!search) return true
      return (
        (o.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase())
      )
    }),
  [rawOrders, search])

  const statusColors = getStatusColors(isDark)

  function handlePrint() {
    const tabLabel = TAB_ITEMS.find((t) => t.id === tab)?.label ?? tab
    const rows = orders
      .map(
        (o) => `<tr>
          <td>${o.invoice_number ?? `Draft #${o.id.slice(-6)}`}</td>
          <td>${o.order_type.replace('_', ' ')}${o.table_name ? ` · Table ${o.table_name}` : ''}</td>
          <td>${o.line_count} items</td>
          <td>${o.status}</td>
          <td style="text-align:right">${formatCurrency(o.grand_total)}</td>
        </tr>`,
      )
      .join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: sans-serif; font-size: 12px; margin: 16px; }
        h2 { margin: 0 0 4px; font-size: 14px; }
        p  { margin: 0 0 12px; font-size: 11px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; border-bottom: 1px solid #ccc; padding: 4px 6px; font-size: 11px; }
        td { padding: 4px 6px; border-bottom: 1px solid #eee; }
      </style></head><body>
      <h2>Orders — ${tabLabel}</h2>
      <p>${new Date().toLocaleString()}</p>
      <table>
        <thead><tr>
          <th>Invoice</th><th>Type</th><th>Items</th><th>Status</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`
    ipc.print.htmlInvoice(html)
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header
        title="Orders"
        onBack={() => navigate('/pos/tables')}
        actions={[
          { icon: Printer, label: '', onClick: handlePrint },
          { icon: RefreshCw, label: '', onClick: () => tab === 'draft' ? loadOrders() : refetch() },
        ]}
      />

      {/* Tabs */}
      <div className={cn('px-4 py-2 shrink-0 border-b', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
        <GridDisplaySelection
          items={TAB_ITEMS}
          selectedIds={[tab]}
          onChange={(ids) => setTab((ids[0] as string) ?? 'draft')}
          isMultiSelect={false}
          columns={3}
          accentColor="orange"
          ariaLabel="Filter orders"
        />
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
                  {order.pos_held === 1 && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-700')}>
                      Held
                    </span>
                  )}
                  {order.sync_status === 'pending' && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-orange-900 text-orange-300' : 'bg-orange-100 text-orange-700')}>
                      Unsynced
                    </span>
                  )}
                </div>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {order.order_type.replace('_', ' ')}
                  {order.table_name ? ` · Table ${order.table_name}` : ''}
                  {' · '}
                  {order.line_count} items
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
