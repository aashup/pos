import { useState } from 'react'
import { Minus, Plus, Trash2, Send, CreditCard, PauseCircle, Loader2, User, X } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { formatCurrency, cn } from '../../lib/utils'
import CustomerModal from './CustomerModal'

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
    customerName, setCustomer, clearCustomer,
    updateQty, removeItem, clearCart,
  } = useCartStore()

  const [showCustomerModal, setShowCustomerModal] = useState(false)

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
      {/* Header — touch-friendly grid row */}
      <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-700">
        {/* Table / order type */}
        <div className="flex flex-col items-center justify-center gap-1 py-3 border-r border-gray-200 dark:border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M5 7v10M19 7v10M8 17h8" />
          </svg>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-full px-1 text-center leading-tight">
            {orderType === 'dine_in' && tableName ? `Table ${tableName}` : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
          </span>
        </div>

        {/* Add / view customer */}
        <div className="relative border-r border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowCustomerModal((v) => !v)}
            className="w-full h-full flex flex-col items-center justify-center gap-1 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 transition-colors"
          >
            <User className={cn('w-7 h-7', customerName ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500')} />
            <span className={cn('text-xs font-medium truncate max-w-full px-1 text-center leading-tight', customerName ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')}>
              {customerName ?? 'Customer'}
            </span>
          </button>
          {customerName && (
            <button
              onClick={clearCustomer}
              className="absolute top-1 right-1 text-gray-300 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {showCustomerModal && (
            <CustomerModal
              onClose={() => setShowCustomerModal(false)}
              onSelect={(id, name) => { setCustomer(id, name); setShowCustomerModal(false) }}
            />
          )}
        </div>

        {/* Item count + clear */}
        <div className="flex flex-col items-center justify-center gap-1 py-3 relative">
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{lines.length}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">item{lines.length !== 1 ? 's' : ''}</span>
          {!isEmpty && (
            <button
              onClick={clearCart}
              className="absolute top-1 right-2 text-xs text-red-400 hover:text-red-600"
            >
              Clear
            </button>
          )}
        </div>
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
