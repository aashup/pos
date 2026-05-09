import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Printer, RotateCcw, Loader2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi } from '../../api/orders'
import { ipc } from '../../bridge/ipc'
import { formatCurrency } from '../../lib/utils'
import { useCartStore } from '../../store/cartStore'
import type { SalesInvoice } from '../../types'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setOrder } = useCartStore()

  const { data: order, isLoading } = useQuery<SalesInvoice>({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await ordersApi.get(id!)
      return res.data?.data
    },
    enabled: !!id,
  })

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id!),
    onSuccess: () => {
      toast.success('Order cancelled')
      qc.invalidateQueries({ queryKey: ['orders-list'] })
      navigate('/pos/orders')
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  const resumeOrder = () => {
    if (!order) return
    setOrder(order.id, order.order_type, order.table_id ?? undefined, order.dining_table?.name)
    navigate('/pos/billing')
  }

  const handleReprint = async () => {
    if (!order) return
    const lines = order.lines ?? []
    const result = await ipc.print.receipt({
      outletName:     'Zazzy Restaurant',
      invoiceNumber:  order.invoice_number ?? 'DRAFT',
      invoiceDate:    new Date(order.invoice_date).toLocaleDateString('en-IN'),
      orderType:      order.order_type,
      tableName:      order.dining_table?.name,
      items: lines.map((l) => ({
        name:      l.item?.name ?? 'Item',
        quantity:  Number(l.quantity),
        rate:      Number(l.rate),
        gstRate:   Number(l.gst_rate),
        lineTotal: Number(l.line_total),
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
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const lines = order.lines ?? []

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos/orders')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">
            {order.invoice_number ?? `Draft #${order.id.slice(-6)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {order.status === 'confirmed' && (
            <button
              onClick={handleReprint}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              Reprint
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Order info */}
        <div className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status</span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
              order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {order.pos_held ? 'Held' : order.status}
            </span>
          </div>
          <InfoRow label="Order Type" value={order.order_type.replace('_', ' ')} />
          {order.dining_table && <InfoRow label="Table" value={order.dining_table.name} />}
          {order.pax > 0 && <InfoRow label="Guests" value={String(order.pax)} />}
          {order.invoice_date && (
            <InfoRow label="Date" value={new Date(order.invoice_date).toLocaleString('en-IN')} />
          )}
          {order.pos_payment_mode && <InfoRow label="Payment" value={order.pos_payment_mode.toUpperCase()} />}
          {order.notes && <InfoRow label="Notes" value={order.notes} />}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">{lines.length} Items</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {lines.map((line) => (
              <div key={line.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{line.item?.name ?? 'Item'}</p>
                  <p className="text-xs text-gray-400">
                    ₹{Number(line.rate).toFixed(2)} × {Number(line.quantity)} · GST {line.gst_rate}%
                  </p>
                  {line.notes && <p className="text-xs text-orange-500">{line.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-gray-800">{formatCurrency(Number(line.line_total))}</p>
                  <span className={`text-xs font-medium ${
                    line.kot_status === 'ready' ? 'text-green-600' :
                    line.kot_status === 'cooking' ? 'text-orange-500' :
                    line.kot_status === 'sent' ? 'text-blue-500' :
                    'text-gray-400'
                  }`}>
                    {line.kot_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
          <TotalRow label="Subtotal"    value={Number(order.taxable_amount)} />
          {Number(order.cgst_total) > 0 && <>
            <TotalRow label="CGST" value={Number(order.cgst_total)} />
            <TotalRow label="SGST" value={Number(order.sgst_total)} />
          </>}
          {Number(order.discount_amount) > 0 && (
            <TotalRow label="Discount" value={-Number(order.discount_amount)} className="text-green-600" />
          )}
          <div className="border-t border-gray-100 pt-2">
            <TotalRow label="Total" value={Number(order.grand_total)} bold />
          </div>
          {order.status === 'confirmed' && Number(order.amount_tendered) > 0 && (
            <>
              <TotalRow label="Tendered" value={Number(order.amount_tendered)} />
              <TotalRow label="Change"   value={Number(order.change_amount ?? 0)} className="text-green-700" />
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
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-sm"
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 capitalize">{value}</span>
    </div>
  )
}

function TotalRow({ label, value, bold, className }: { label: string; value: number; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-gray-900' : 'text-gray-600'} ${className ?? ''}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  )
}
