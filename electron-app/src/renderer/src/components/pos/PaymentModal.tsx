import { useState } from 'react'
import { X, Loader2, Banknote, Smartphone, CreditCard, Tag, SplitSquareHorizontal, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi, type CheckoutPayload } from '../../api/orders'
import { ipc, type CheckoutData } from '../../bridge/ipc'
import { useCartStore } from '../../store/cartStore'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, cn } from '../../lib/utils'
import type { CartLine } from '../../types'

interface CartTotals {
  subtotal: number
  cgstTotal: number
  sgstTotal: number
  grandTotal: number
  netPayable: number
}

interface Props {
  orderId: string | null        // server UUID (occupied table resume) or null
  localOrderId: string | null   // local SQLite UUID (offline-first new orders)
  orderType: string
  lines: CartLine[]
  totals: CartTotals
  onClose: () => void
  onSuccess: (serverId?: string, shouldPrint?: boolean) => void
}

type PayMode = 'cash' | 'upi' | 'card' | 'credit'

interface SplitRow {
  mode: PayMode
  amount: string
  tendered: string
}

const QUICK_CASH = [20, 50, 100, 200, 500, 1000, 2000]

const MODE_ICONS: Record<PayMode, React.ElementType | null> = {
  cash: Banknote, upi: Smartphone, card: CreditCard, credit: null,
}
const MODE_LABELS: Record<PayMode, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit',
}

export default function PaymentModal({ orderId, localOrderId, orderType, lines, totals, onClose, onSuccess }: Props) {
  const { theme } = useThemeStore()
  const { orderNotes } = useCartStore()
  const isDark = theme === 'dark'
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [tendered, setTendered] = useState('')
  const [discountAmt, setDiscountAmt] = useState('')
  const [notes, setNotes] = useState(orderNotes)
  const [loading, setLoading] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [isSplit, setIsSplit] = useState(false)
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    { mode: 'cash', amount: '', tendered: '' },
    { mode: 'upi',  amount: '', tendered: '' },
  ])

  const discountNum = parseFloat(discountAmt) || 0
  const netPayable  = Math.max(0, totals.netPayable - discountNum)
  const tenderedNum = parseFloat(tendered) || 0
  const change      = Math.max(0, tenderedNum - netPayable)

  // Split helpers
  const splitTotal     = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const splitRemaining = Math.max(0, netPayable - splitTotal)

  const updateSplit = (i: number, field: keyof SplitRow, val: string) =>
    setSplitRows((rows) => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))

  const autofillLastSplit = () => {
    setSplitRows((rows) => {
      const newRows = [...rows]
      const filled  = newRows.slice(0, -1).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      newRows[newRows.length - 1] = {
        ...newRows[newRows.length - 1],
        amount: Math.max(0, netPayable - filled).toFixed(2),
      }
      return newRows
    })
  }

  const handleCheckout = async (shouldPrint = false) => {
    if (isSplit) {
      if (Math.abs(splitTotal - netPayable) > 0.5) {
        toast.error(`Split amounts (${formatCurrency(splitTotal)}) must equal bill total (${formatCurrency(netPayable)})`)
        return
      }
      const cashRow = splitRows.find((r) => r.mode === 'cash')
      if (cashRow) {
        const t = parseFloat(cashRow.tendered) || parseFloat(cashRow.amount) || 0
        const a = parseFloat(cashRow.amount) || 0
        if (t > 0 && t < a) { toast.error('Insufficient cash tendered'); return }
      }
    } else {
      if (payMode === 'cash' && tenderedNum > 0 && tenderedNum < netPayable) {
        toast.error('Insufficient cash tendered')
        return
      }
    }

    setLoading(true)
    try {
      if (localOrderId) {
        // ── Offline-first path: write to SQLite, push to server in background ──
        const tenderedFinal = !isSplit && payMode === 'cash' ? (tenderedNum || netPayable) : netPayable
        const checkoutData: CheckoutData = {
          payment_mode: isSplit ? 'split' : payMode,
          amount_paid: netPayable,
          amount_tendered: tenderedFinal,
          change_amount: Math.max(0, tenderedFinal - netPayable),
          balance_due: 0,
          discount_amount: discountNum,
          grand_total: netPayable,
          taxable_amount: totals.subtotal,
          cgst_total: totals.cgstTotal,
          sgst_total: totals.sgstTotal,
          split_payments: isSplit
            ? splitRows
                .filter((r) => (parseFloat(r.amount) || 0) > 0)
                .map((r) => ({ mode: r.mode, amount: parseFloat(r.amount) || 0, tendered: parseFloat(r.tendered) || undefined }))
            : undefined,
          notes: notes.trim() || undefined,
        }
        await ipc.order.checkout(localOrderId, checkoutData)
        onSuccess(undefined, shouldPrint)
      } else if (orderId && !orderId.startsWith('local-')) {
        // ── Server-resumed occupied table: API path ──────────────────────────
        const pendingLines = lines.filter((l) => l.kotStatus === 'pending')
        if (pendingLines.length > 0) {
          await ordersApi.addLines(
            orderId,
            pendingLines.map((l) => ({
              item_id: l.itemId,
              quantity: l.quantity,
              rate: l.rate,
              discount_percent: l.discountPct,
              gst_rate: l.gstRate,
              notes: l.notes || undefined,
            })),
          )
          useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
        }
        let payload: CheckoutPayload
        if (isSplit) {
          payload = {
            payment_mode: 'split',
            discount_amount: discountNum > 0 ? discountNum : undefined,
            notes: notes.trim() || undefined,
            split_payments: splitRows
              .filter((r) => (parseFloat(r.amount) || 0) > 0)
              .map((r) => ({ mode: r.mode, amount: parseFloat(r.amount) || 0, tendered: parseFloat(r.tendered) || undefined })),
          }
        } else {
          payload = {
            payment_mode: payMode,
            amount_tendered: payMode === 'cash' ? (tenderedNum || netPayable) : netPayable,
            discount_amount: discountNum > 0 ? discountNum : undefined,
            notes: notes.trim() || undefined,
          }
        }
        await ordersApi.checkout(orderId, payload)
        onSuccess(orderId, shouldPrint)
      } else {
        toast.error('No active order')
      }
    } catch {
      // Error handled by axios interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={cn('rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto', isDark ? 'bg-gray-900' : 'bg-white')}>
        {/* Header */}
        <div className={cn('flex items-center justify-between p-4 border-b sticky top-0 rounded-t-2xl', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
          <h2 className={cn('font-bold', isDark ? 'text-gray-100' : 'text-gray-900')}>Payment</h2>
          <button onClick={onClose} className={cn('', isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Amount due */}
          <div className={cn('rounded-xl p-3 text-center', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Amount Due</p>
            <p className={cn('text-3xl font-bold', isDark ? 'text-gray-100' : 'text-gray-900')}>{formatCurrency(netPayable)}</p>
            {discountNum > 0 && (
              <p className={cn('text-xs mt-0.5', isDark ? 'text-green-400' : 'text-green-600')}>
                Discount –{formatCurrency(discountNum)} applied
              </p>
            )}
            {totals.cgstTotal > 0 && (
              <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                incl. CGST {formatCurrency(totals.cgstTotal)} + SGST {formatCurrency(totals.sgstTotal)}
              </p>
            )}
          </div>

          {/* Discount toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiscount((v) => !v)}
              className={cn('flex items-center gap-1.5 text-xs', isDark ? 'text-gray-500 hover:text-orange-400' : 'text-gray-500 hover:text-orange-600')}
            >
              <Tag className="w-3.5 h-3.5" />
              {showDiscount ? 'Remove discount' : 'Add discount'}
            </button>
            <button
              onClick={() => setIsSplit((v) => !v)}
              className={cn('flex items-center gap-1.5 text-xs', isSplit ? 'text-blue-400' : isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-500 hover:text-blue-600')}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              {isSplit ? 'Cancel split' : 'Split payment'}
            </button>
          </div>

          {showDiscount && (
            <div>
              <label className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Discount (₹)</label>
              <input
                type="number"
                value={discountAmt}
                onChange={(e) => setDiscountAmt(e.target.value)}
                placeholder="0"
                min="0"
                max={totals.netPayable}
                className={cn('w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200')}
              />
            </div>
          )}

          {/* ── Single payment mode ── */}
          {!isSplit && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'upi', 'card', 'credit'] as const).map((mode) => {
                  const Icon = MODE_ICONS[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setPayMode(mode)}
                      className={cn('flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors',
                        payMode === mode
                          ? isDark ? 'border-orange-500 bg-orange-900/30 text-orange-300' : 'border-orange-500 bg-orange-50 text-orange-700'
                          : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      {MODE_LABELS[mode]}
                    </button>
                  )
                })}
              </div>

              {payMode === 'cash' && (
                <div className="space-y-2">
                  <label className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Cash Tendered</label>
                  <input
                    type="number"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={netPayable.toFixed(0)}
                    className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200')}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CASH.filter((v) => v >= netPayable - 1 || v >= 100).slice(0, 6).map((v) => (
                      <button
                        key={v}
                        onClick={() => setTendered(String(v))}
                        className={cn('px-2.5 py-1 rounded text-xs font-medium', isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200')}
                      >
                        ₹{v}
                      </button>
                    ))}
                    <button
                      onClick={() => setTendered(netPayable.toFixed(0))}
                      className={cn('px-2.5 py-1 border rounded text-xs font-medium', isDark ? 'bg-orange-900/30 border-orange-700 text-orange-300 hover:bg-orange-900/50' : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700')}
                    >
                      Exact
                    </button>
                  </div>
                  {tenderedNum >= netPayable && (
                    <div className={cn('flex justify-between text-sm font-semibold rounded-lg px-3 py-2', isDark ? 'bg-green-900/30 text-green-300' : 'text-green-700 bg-green-50')}>
                      <span>Change</span>
                      <span>{formatCurrency(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {payMode === 'credit' && (
                <div className={cn('border rounded-lg px-3 py-2 text-xs', isDark ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800')}>
                  Order will be marked as credit. Customer balance will be updated.
                </div>
              )}
            </>
          )}

          {/* ── Split payment mode ── */}
          {isSplit && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Split amounts</p>
                <button
                  onClick={autofillLastSplit}
                  className={cn('text-xs', isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700')}
                >
                  Autofill remaining
                </button>
              </div>

              {splitRows.map((row, i) => {
                const Icon = MODE_ICONS[row.mode]
                return (
                  <div key={i} className={cn('border rounded-xl p-3 space-y-2', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200')}>
                    {/* Mode selector for this row */}
                    <div className="flex gap-1.5">
                      {(['cash', 'upi', 'card', 'credit'] as const).map((m) => {
                        const MI = MODE_ICONS[m]
                        return (
                          <button
                            key={m}
                            onClick={() => updateSplit(i, 'mode', m)}
                            className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                              row.mode === m
                                ? isDark ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-blue-500 bg-blue-50 text-blue-700'
                                : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            )}
                          >
                            {MI && <MI className="w-3 h-3" />}
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Amount (₹)</label>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateSplit(i, 'amount', e.target.value)}
                          placeholder="0"
                          className={cn('w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400', isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200')}
                        />
                      </div>
                      {row.mode === 'cash' && (
                        <div className="flex-1">
                          <label className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>Tendered (₹)</label>
                          <input
                            type="number"
                            value={row.tendered}
                            onChange={(e) => updateSplit(i, 'tendered', e.target.value)}
                            placeholder={row.amount || '0'}
                            className={cn('w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400', isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-200')}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Running total */}
              <div className={cn('flex justify-between text-sm font-semibold px-3 py-2 rounded-lg',
                Math.abs(splitTotal - netPayable) < 0.5
                  ? isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                  : isDark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-50 text-orange-700'
              )}>
                <span>Split total</span>
                <span>
                  {formatCurrency(splitTotal)}
                  {splitRemaining > 0.5 && <span className="text-xs font-normal ml-1">(₹{splitRemaining.toFixed(0)} remaining)</span>}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note (optional)"
            className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200')}
          />
        </div>

        {/* Confirm */}
        <div className={cn('p-4 border-t sticky bottom-0 rounded-b-2xl space-y-2', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
          {(() => {
            const isDisabled =
              loading ||
              (!isSplit && payMode === 'cash' && tenderedNum > 0 && tenderedNum < netPayable) ||
              (isSplit && Math.abs(splitTotal - netPayable) > 0.5)
            return (
              <>
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={isDisabled}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Payment · {formatCurrency(netPayable)}
                </button>
                <button
                  onClick={() => handleCheckout(true)}
                  disabled={isDisabled}
                  className={cn('w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 border transition-colors disabled:opacity-40',
                    isDark ? 'border-orange-500 text-orange-300 hover:bg-orange-900/30' : 'border-orange-500 text-orange-600 hover:bg-orange-50'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Confirm & Print · {formatCurrency(netPayable)}
                </button>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
