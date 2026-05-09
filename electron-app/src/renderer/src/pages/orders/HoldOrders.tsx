import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi } from '../../api/orders'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency } from '../../lib/utils'
import type { SalesInvoice } from '../../types'

export default function HoldOrders() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setOrder } = useCartStore()

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
        navigate('/pos/billing')
      }
    },
    onError: () => toast.error('Failed to resume order'),
  })

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => navigate('/pos/billing')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-orange-400 text-sm">Held Orders</span>
        <span className="text-gray-500 text-xs ml-auto">{orders.length} held</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400">
            <p className="text-sm">No held orders</p>
            <p className="text-xs mt-1">Use "Hold" from the billing screen to park an order</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">
                      {order.order_type === 'dine_in' && order.dining_table
                        ? `Table ${order.dining_table.name}`
                        : order.order_type === 'takeaway'
                        ? 'Takeaway'
                        : 'Delivery'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.lines?.length ?? 0} items · {formatCurrency(order.grand_total)}
                    </p>
                    {order.notes && (
                      <p className="text-xs text-orange-500 mt-1 truncate">{order.notes}</p>
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
                      <span key={l.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {l.quantity}× {l.item?.name ?? 'Item'}
                      </span>
                    ))}
                    {(order.lines ?? []).length > 5 && (
                      <span className="text-xs text-gray-400">+{(order.lines ?? []).length - 5} more</span>
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
