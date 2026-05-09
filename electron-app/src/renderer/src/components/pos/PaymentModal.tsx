import { useState } from 'react'
import { X, Loader2, Banknote, Smartphone, CreditCard, Tag, SplitSquareHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi, type CheckoutPayload } from '../../api/orders'
import { formatCurrency } from '../../lib/utils'
import type { CartLine } from '../../types'

interface CartTotals {
  subtotal: number
  cgstTotal: number
  sgstTotal: number
  grandTotal: number
  netPayable: number
}

interface Props {
  orderId: string | null
  orderType: string
  lines: CartLine[]
  totals: CartTotals
  onClose: () => void
  onSuccess: () => void
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

export default function PaymentModal({ orderId, orderType, lines, totals, onClose, onSuccess }: Props) {
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [tendered, setTendered] = useState('')
  const [discountAmt, setDiscountAmt] = useState('')
  const [notes, setNotes] = useState('')
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

  const handleCheckout = async () => {
    if (!orderId) { toast.error('No active order'); return }

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
      let payload: CheckoutPayload
      if (isSplit) {
        payload = {
          payment_mode: 'split',
          discount_amount: discountNum > 0 ? discountNum : undefined,
          notes: notes.trim() || undefined,
          split_payments: splitRows
            .filter((r) => (parseFloat(r.amount) || 0) > 0)
            .map((r) => ({
              mode: r.mode,
              amount: parseFloat(r.amount) || 0,
              tendered: parseFloat(r.tendered) || undefined,
            })),
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
      onSuccess()
    } catch {
      // Error handled by axios interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-bold text-gray-900">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Amount due */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Amount Due</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(netPayable)}</p>
            {discountNum > 0 && (
              <p className="text-xs text-green-600 mt-0.5">
                Discount –{formatCurrency(discountNum)} applied
              </p>
            )}
            {totals.cgstTotal > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                incl. CGST {formatCurrency(totals.cgstTotal)} + SGST {formatCurrency(totals.sgstTotal)}
              </p>
            )}
          </div>

          {/* Discount toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiscount((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-600"
            >
              <Tag className="w-3.5 h-3.5" />
              {showDiscount ? 'Remove discount' : 'Add discount'}
            </button>
            <button
              onClick={() => setIsSplit((v) => !v)}
              className={`flex items-center gap-1.5 text-xs ${isSplit ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              {isSplit ? 'Cancel split' : 'Split payment'}
            </button>
          </div>

          {showDiscount && (
            <div>
              <label className="text-sm font-medium text-gray-700">Discount (₹)</label>
              <input
                type="number"
                value={discountAmt}
                onChange={(e) => setDiscountAmt(e.target.value)}
                placeholder="0"
                min="0"
                max={totals.netPayable}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                        payMode === mode
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      {MODE_LABELS[mode]}
                    </button>
                  )
                })}
              </div>

              {payMode === 'cash' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Cash Tendered</label>
                  <input
                    type="number"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={netPayable.toFixed(0)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CASH.filter((v) => v >= netPayable - 1 || v >= 100).slice(0, 6).map((v) => (
                      <button
                        key={v}
                        onClick={() => setTendered(String(v))}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium"
                      >
                        ₹{v}
                      </button>
                    ))}
                    <button
                      onClick={() => setTendered(netPayable.toFixed(0))}
                      className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded text-xs font-medium text-orange-700"
                    >
                      Exact
                    </button>
                  </div>
                  {tenderedNum >= netPayable && (
                    <div className="flex justify-between text-sm font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">
                      <span>Change</span>
                      <span>{formatCurrency(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {payMode === 'credit' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
                  Order will be marked as credit. Customer balance will be updated.
                </div>
              )}
            </>
          )}

          {/* ── Split payment mode ── */}
          {isSplit && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Split amounts</p>
                <button
                  onClick={autofillLastSplit}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Autofill remaining
                </button>
              </div>

              {splitRows.map((row, i) => {
                const Icon = MODE_ICONS[row.mode]
                return (
                  <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    {/* Mode selector for this row */}
                    <div className="flex gap-1.5">
                      {(['cash', 'upi', 'card', 'credit'] as const).map((m) => {
                        const MI = MODE_ICONS[m]
                        return (
                          <button
                            key={m}
                            onClick={() => updateSplit(i, 'mode', m)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              row.mode === m
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {MI && <MI className="w-3 h-3" />}
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Amount (₹)</label>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateSplit(i, 'amount', e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      {row.mode === 'cash' && (
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Tendered (₹)</label>
                          <input
                            type="number"
                            value={row.tendered}
                            onChange={(e) => updateSplit(i, 'tendered', e.target.value)}
                            placeholder={row.amount || '0'}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Running total */}
              <div className={`flex justify-between text-sm font-semibold px-3 py-2 rounded-lg ${
                Math.abs(splitTotal - netPayable) < 0.5
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}>
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Confirm */}
        <div className="p-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={handleCheckout}
            disabled={
              loading ||
              (!isSplit && payMode === 'cash' && tenderedNum > 0 && tenderedNum < netPayable) ||
              (isSplit && Math.abs(splitTotal - netPayable) > 0.5)
            }
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Payment · {formatCurrency(netPayable)}
          </button>
        </div>
      </div>
    </div>
  )
}
