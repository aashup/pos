import { Minus, Plus, Trash2, Send, CreditCard, PauseCircle, Loader2 } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency, cn } from '../../lib/utils'

interface CartProps {
  onSendKot: () => void
  onCharge: () => void
  onHold?: () => void
  sendingKot?: boolean
  holdingOrder?: boolean
}

export default function Cart({ onSendKot, onCharge, onHold, sendingKot, holdingOrder }: CartProps) {
  const {
    lines, totals, tableName, orderType,
    updateQty, removeItem, clearCart,
  } = useCartStore()

  const pendingLines = lines.filter((l) => l.kotStatus === 'pending')
  const hasSentLines = lines.some((l) => l.kotStatus !== 'pending')
  const isEmpty = lines.length === 0

  const kotStatusColor = (status: string) => {
    switch (status) {
      case 'sent':    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      case 'cooking': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
      case 'ready':   return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      case 'served':  return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
      default:        return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">
            {orderType === 'dine_in' && tableName ? `Table ${tableName}` : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{lines.length} item{lines.length !== 1 ? 's' : ''}</p>
        </div>
        {!isEmpty && (
          <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600">
            Clear
          </button>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 text-sm">
            <p>Cart is empty</p>
            <p className="text-xs mt-1">Click items to add</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {lines.map((line) => (
              <div key={line.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{line.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">₹{line.rate} × {line.quantity} = ₹{(line.rate * line.quantity).toFixed(2)}</p>
                  </div>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', kotStatusColor(line.kotStatus))}>
                    {line.kotStatus === 'pending' ? 'new' : line.kotStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(line.id, line.quantity - 1)}
                      disabled={line.kotStatus !== 'pending'}
                      className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                    >
                      <Minus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-gray-800 dark:text-gray-100">{line.quantity}</span>
                    <button
                      onClick={() => updateQty(line.id, line.quantity + 1)}
                      disabled={line.kotStatus !== 'pending'}
                      className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(line.id)}
                    disabled={line.kotStatus !== 'pending'}
                    className="text-red-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {!isEmpty && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.cgstTotal > 0 && (
            <>
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>CGST</span>
                <span>{formatCurrency(totals.cgstTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>SGST</span>
                <span>{formatCurrency(totals.sgstTotal)}</span>
              </div>
            </>
          )}
          {totals.roundOff !== 0 && (
            <div className="flex justify-between text-gray-400 dark:text-gray-500 text-xs">
              <span>Round off</span>
              <span>{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 dark:text-gray-50 text-base pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Total</span>
            <span>{formatCurrency(totals.netPayable)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
        {orderType === 'dine_in' && (
          <button
            onClick={onSendKot}
            disabled={pendingLines.length === 0 || sendingKot}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            Send to Kitchen {pendingLines.length > 0 && `(${pendingLines.length})`}
          </button>
        )}
        <button
          onClick={onCharge}
          disabled={isEmpty || (orderType === 'dine_in' && !hasSentLines && pendingLines.length > 0)}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          Charge {!isEmpty && formatCurrency(totals.netPayable)}
        </button>
        {onHold && !isEmpty && (
          <button
            onClick={onHold}
            disabled={holdingOrder}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-200 font-medium py-2 rounded-xl transition-colors text-sm"
          >
            {holdingOrder
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <PauseCircle className="w-4 h-4" />
            }
            Hold Order
          </button>
        )}
      </div>
    </div>
  )
}
