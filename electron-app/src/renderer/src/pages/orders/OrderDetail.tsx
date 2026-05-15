import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Printer, RotateCcw, Loader2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ipc } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { useOrdersStore } from '../../store/ordersStore'
import { formatCurrency, cn } from '../../lib/utils'
import { useCartStore } from '../../store/cartStore'
import Header from '../../components/layout/Header'
import type { LocalOrderFull, LocalOrderLine } from '../../bridge/ipc'

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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setLocalOrder, populateLines } = useCartStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const { data: order, isLoading } = useQuery<LocalOrderFull>({
    queryKey: ['order', id],
    queryFn: () => ipc.order.get(id!) as Promise<LocalOrderFull>,
    enabled: !!id,
  })

  const cancelMutation = useMutation({
    mutationFn: () => ipc.order.cancel(id!),
    onSuccess: () => {
      toast.success('Order cancelled')
      useOrdersStore.getState().removeOrder(id!)
      navigate('/pos/orders')
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  const resumeOrder = async () => {
    if (!order) return
    await ipc.order.unhold(order.id).catch(() => {})
    useOrdersStore.getState().removeHeld(order.id)
    const cartLines = mapToCartLines(order.lines ?? [])
    populateLines(cartLines, order.id)
    setLocalOrder(order.id, order.order_type, order.table_id ?? undefined, order.table_name ?? undefined)
    navigate('/pos/billing')
  }

  const handleReprint = async () => {
    if (!order) return
    const lines = order.lines ?? []
    const result = await ipc.print.receipt({
      outletName:     'Zazzy Restaurant',
      invoiceNumber:  order.invoice_number ?? 'DRAFT',
      invoiceDate:    order.invoice_date ? new Date(order.invoice_date).toLocaleDateString('en-IN') : new Date(order.created_at).toLocaleDateString('en-IN'),
      orderType:      order.order_type,
      tableName:      order.table_name ?? undefined,
      items: lines.map((l) => ({
        name:      l.item_name,
        quantity:  Number(l.quantity),
        rate:      Number(l.rate),
        gstRate:   Number(l.gst_rate),
        lineTotal: Number((l as any).line_total ?? 0),
      })),
      subtotal:       Number(order.taxable_amount),
      cgst:           Number(order.cgst_total),
      sgst:           Number(order.sgst_total),
      discount:       Number(order.discount_amount ?? 0),
      grandTotal:     Number(order.grand_total),
      paymentMode:    order.pos_payment_mode ?? 'cash',
      amountTendered: Number(order.amount_tendered ?? 0),
      change:         Number(order.change_amount ?? 0),
    })
    if (result.success) toast.success('Reprint sent to printer')
    else toast.error(result.error ?? 'Print failed')
  }

  if (isLoading || !order) {
    return (
      <div className={cn('h-screen flex items-center justify-center', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-500' : 'text-gray-400')} />
      </div>
    )
  }

  const lines = order.lines ?? []
  const actions = order.status === 'confirmed' ? [{ icon: Printer, label: 'Reprint', onClick: handleReprint }] : []

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header
        title={order.invoice_number ?? `Draft #${order.id.slice(-6)}`}
        onBack={() => navigate('/pos/orders')}
        actions={actions}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Order info */}
        <div className={cn('rounded-xl p-4 space-y-2', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>Status</span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              order.status === 'confirmed' ? (isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700') :
              order.status === 'cancelled' ? (isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-600') :
              isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {order.pos_held ? 'Held' : order.status}
            </span>
          </div>
          <InfoRow label="Order Type" value={order.order_type.replace('_', ' ')} isDark={isDark} />
          {order.table_name && <InfoRow label="Table" value={order.table_name} isDark={isDark} />}
          {order.pax > 0 && <InfoRow label="Guests" value={String(order.pax)} isDark={isDark} />}
          {order.created_at && (
            <InfoRow label="Date" value={new Date(order.created_at).toLocaleString('en-IN')} isDark={isDark} />
          )}
          {order.pos_payment_mode && <InfoRow label="Payment" value={order.pos_payment_mode.toUpperCase()} isDark={isDark} />}
          {order.notes && <InfoRow label="Notes" value={order.notes} isDark={isDark} />}
          {order.sync_status === 'pending' && (
            <InfoRow label="Sync" value="Pending upload" isDark={isDark} />
          )}
        </div>

        {/* Items */}
        <div className={cn('rounded-xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div className={cn('px-4 py-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>{lines.length} Items</h3>
          </div>
          <div className={cn('divide-y', isDark ? 'divide-gray-800' : 'divide-gray-50')}>
            {lines.map((line) => (
              <div key={line.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{line.item_name}</p>
                  <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    ₹{Number(line.rate).toFixed(2)} × {Number(line.quantity)} · GST {line.gst_rate}%
                  </p>
                  {line.notes && <p className={cn('text-xs', isDark ? 'text-orange-400' : 'text-orange-600')}>{line.notes}</p>}
                </div>
                <div className="text-right">
                  <p className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(Number((line as any).line_total ?? 0))}</p>
                  <span className={`text-xs font-medium ${
                    line.kot_status === 'ready' ? (isDark ? 'text-green-400' : 'text-green-600') :
                    line.kot_status === 'cooking' ? (isDark ? 'text-orange-400' : 'text-orange-500') :
                    line.kot_status === 'sent' ? (isDark ? 'text-blue-400' : 'text-blue-500') :
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {line.kot_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className={cn('rounded-xl p-4 space-y-2 text-sm', isDark ? 'bg-gray-900' : 'bg-white')}>
          <TotalRow label="Subtotal"    value={Number(order.taxable_amount)} isDark={isDark} />
          {Number(order.cgst_total) > 0 && <>
            <TotalRow label="CGST" value={Number(order.cgst_total)} isDark={isDark} />
            <TotalRow label="SGST" value={Number(order.sgst_total)} isDark={isDark} />
          </>}
          {Number(order.discount_amount) > 0 && (
            <TotalRow label="Discount" value={-Number(order.discount_amount)} className={isDark ? 'text-green-400' : 'text-green-600'} isDark={isDark} />
          )}
          <div className={cn('border-t pt-2', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <TotalRow label="Total" value={Number(order.grand_total)} bold isDark={isDark} />
          </div>
          {order.status === 'confirmed' && Number(order.amount_tendered) > 0 && (
            <>
              <TotalRow label="Tendered" value={Number(order.amount_tendered)} isDark={isDark} />
              <TotalRow label="Change"   value={Number(order.change_amount ?? 0)} className={isDark ? 'text-green-400' : 'text-green-700'} isDark={isDark} />
            </>
          )}
        </div>

        {/* Actions */}
        {order.status === 'draft' && (
          <div className="flex gap-3">
            <button
              onClick={resumeOrder}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Resume Order
            </button>
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className={cn('flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm', isDark ? 'bg-red-900 hover:bg-red-800 text-red-200' : 'bg-red-50 hover:bg-red-100 text-red-600')}
            >
              {cancelMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <XCircle className="w-4 h-4" />
              }
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
      <span className={cn('font-medium capitalize', isDark ? 'text-gray-200' : 'text-gray-800')}>{value}</span>
    </div>
  )
}

function TotalRow({ label, value, bold, className, isDark }: { label: string; value: number; bold?: boolean; className?: string; isDark: boolean }) {
  return (
    <div className={cn('flex justify-between', bold ? (isDark ? 'font-bold text-gray-200' : 'font-bold text-gray-900') : (isDark ? 'text-gray-400' : 'text-gray-600'), className ?? '')}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  )
}
