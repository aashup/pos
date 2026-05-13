import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi } from '../../api/orders'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, cn } from '../../lib/utils'
import { useCartStore } from '../../store/cartStore'
import Header from '../../components/layout/Header'
import type { SalesInvoice } from '../../types'

export default function HoldOrders() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setOrder } = useCartStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const { data: orders = [], isLoading } = useQuery<SalesInvoice[]>({
    queryKey: ['held-orders'],
    queryFn: async () => {
      const res = await ordersApi.list({ status: 'draft' })
      const all = (res.data?.data ?? []) as SalesInvoice[]
      return all.filter((o) => o.pos_held)
    },
    refetchInterval: 15_000,
  })

  const unholdMutation = useMutation({
    mutationFn: (id: string) => ordersApi.unhold(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['held-orders'] })
      const order = orders.find((o) => o.id === id)
      if (order) {
        setOrder(order.id, order.order_type, order.table_id ?? undefined, order.dining_table?.name)
        navigate('/pos/tables')
      }
    },
    onError: () => toast.error('Failed to resume order'),
  })

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title={`Held Orders (${orders.length})`} onBack={() => navigate('/pos/tables')} />

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : orders.length === 0 ? (
          <div className={cn('flex flex-col items-center justify-center h-60', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <p className="text-sm">No held orders</p>
            <p className="text-xs mt-1">Use "Hold" from the billing screen to park an order</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className={cn('rounded-2xl p-4 shadow-sm border', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                      {order.order_type === 'dine_in' && order.dining_table
                        ? `Table ${order.dining_table.name}`
                        : order.order_type === 'takeaway'
                        ? 'Takeaway'
                        : 'Delivery'}
                    </p>
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {order.lines?.length ?? 0} items · {formatCurrency(order.grand_total)}
                    </p>
                    {order.notes && (
                      <p className={cn('text-xs mt-1 truncate', isDark ? 'text-orange-400' : 'text-orange-600')}>{order.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => unholdMutation.mutate(order.id)}
                    disabled={unholdMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shrink-0"
                  >
                    {unholdMutation.isPending && unholdMutation.variables === order.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                    Resume
                  </button>
                </div>

                {/* Items preview */}
                {(order.lines ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(order.lines ?? []).slice(0, 5).map((l) => (
                      <span key={l.id} className={cn('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                        {l.quantity}× {l.item?.name ?? 'Item'}
                      </span>
                    ))}
                    {(order.lines ?? []).length > 5 && (
                      <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>+{(order.lines ?? []).length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
