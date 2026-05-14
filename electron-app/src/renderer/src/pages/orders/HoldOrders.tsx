import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ipc } from '../../bridge/ipc'
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, cn } from '../../lib/utils'
import { useCartStore } from '../../store/cartStore'
import Header from '../../components/layout/Header'
import type { LocalHeldOrder, LocalOrderLine } from '../../bridge/ipc'

function mapToCartLines(lines: LocalOrderLine[]) {
  return lines.map((l) => ({
    id: l.id,
    itemId: l.item_id,
    comboId: null,
    name: l.item_name,
    rate: l.rate,
    unit: l.unit,
    gstRate: l.gst_rate,
    quantity: l.quantity,
    discountPct: l.discount_percent ?? 0,
    modifiersTotal: 0,
    kotStatus: l.kot_status as 'pending' | 'sent' | 'cooking' | 'ready' | 'served',
    notes: l.notes ?? '',
    variantId: l.item_variant_id ?? null,
    variantName: null,
    selectedModifiers: [],
  }))
}

export default function HoldOrders() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setLocalOrder, populateLines } = useCartStore()
  const { theme } = useThemeStore()
  const { status: syncStatus } = useSyncStore()
  const isDark = theme === 'dark'
  const [resuming, setResuming] = useState<string | null>(null)

  const { data: orders = [], isLoading, refetch } = useQuery<LocalHeldOrder[]>({
    queryKey: ['held-orders'],
    queryFn: () => ipc.order.listHeld() as Promise<LocalHeldOrder[]>,
    staleTime: 10_000,
  })

  const prevSync = useRef(syncStatus)
  useEffect(() => {
    if (prevSync.current === 'syncing' && syncStatus === 'idle') refetch()
    prevSync.current = syncStatus
  }, [syncStatus])

  const handleResume = async (order: LocalHeldOrder) => {
    setResuming(order.id)
    try {
      await ipc.order.unhold(order.id)
      const full = await ipc.order.get(order.id)
      if (!full) { toast.error('Order not found'); return }
      const cartLines = mapToCartLines((full as any).lines ?? order.lines)
      populateLines(cartLines, full.id)
      setLocalOrder(full.id, full.order_type, (full as any).table_id ?? undefined, (full as any).table_name ?? undefined)
      qc.invalidateQueries({ queryKey: ['held-orders'] })
      navigate('/pos/billing')
    } catch {
      toast.error('Failed to resume order')
    } finally {
      setResuming(null)
    }
  }

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
                      {order.order_type === 'dine_in' && order.table_name
                        ? `Table ${order.table_name}`
                        : order.order_type === 'takeaway'
                        ? 'Takeaway'
                        : 'Delivery'}
                    </p>
                    <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {order.line_count} items · {formatCurrency(order.grand_total)}
                    </p>
                    {order.notes && (
                      <p className={cn('text-xs mt-1 truncate', isDark ? 'text-orange-400' : 'text-orange-600')}>{order.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleResume(order)}
                    disabled={resuming === order.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shrink-0"
                  >
                    {resuming === order.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                    Resume
                  </button>
                </div>

                {/* Items preview */}
                {order.lines.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {order.lines.slice(0, 5).map((l) => (
                      <span key={l.id} className={cn('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                        {l.quantity}× {l.item_name}
                      </span>
                    ))}
                    {order.lines.length > 5 && (
                      <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>+{order.lines.length - 5} more</span>
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
