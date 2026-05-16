import { useState, useRef, useEffect } from 'react'
import { Trash2, Send, CreditCard, PauseCircle, Loader2, User, X, MessageSquare, FileText, Printer, Monitor } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { ipc } from '../../bridge/ipc'
import { formatCurrency, cn } from '../../lib/utils'
import CustomerModal from './CustomerModal'

interface CartProps {
  onSendKot: () => void
  onCharge: () => void
  onHold?: () => void
  onPrint?: () => void
  onKotDisplay?: () => void
  sendingKot?: boolean
  holdingOrder?: boolean
}

export default function Cart({ onSendKot, onCharge, onHold, onPrint, onKotDisplay, sendingKot, holdingOrder }: CartProps) {
  const {
    lines, totals, tableName, orderType, localOrderId,
    orderNotes, setOrderNotes,
    customerName, setCustomer, clearCustomer,
    updateQty, removeItem, clearCart, setLineNotes,
  } = useCartStore()

  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [editingOrderNote, setEditingOrderNote] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const orderNoteRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (openNoteId) noteInputRef.current?.focus()
  }, [openNoteId])

  useEffect(() => {
    if (editingOrderNote) { setDraftNote(orderNotes); orderNoteRef.current?.focus() }
  }, [editingOrderNote])

  const saveOrderNote = () => {
    setOrderNotes(draftNote)
    if (localOrderId) ipc.order.updateNotes(localOrderId, draftNote.trim() || null).catch(() => {})
    setEditingOrderNote(false)
  }

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
      <div className="grid grid-cols-4 border-b border-gray-200 dark:border-gray-700">
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
            onClick={() => setShowCustomerModal(true)}
            className="w-full h-full flex flex-col items-center justify-center gap-1 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 transition-colors"
          >
            <User className={cn('w-7 h-7', customerName ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500')} />
            <span className={cn('text-xs font-medium truncate max-w-full px-1 text-center leading-tight', customerName ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')}>
              {customerName ?? 'Walk-In'}
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
              onSelect={(id, name) => { if (id === 'walk_in') clearCustomer(); else setCustomer(id, name); setShowCustomerModal(false) }}
            />
          )}
        </div>

        {/* Item count */}
        <div className="flex flex-col items-center justify-center gap-1 py-3 border-r border-gray-200 dark:border-gray-700">
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{lines.length}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">item{lines.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Clear cart */}
        <button
          onClick={clearCart}
          disabled={isEmpty}
          className="flex flex-col items-center justify-center gap-1 py-3 transition-colors disabled:opacity-30 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 disabled:pointer-events-none"
        >
          <Trash2 className="w-7 h-7 text-red-400 dark:text-red-500" />
          <span className="text-xs font-medium text-red-400 dark:text-red-500">Clear</span>
        </button>
      </div>

      {/* Order notes row */}
      {editingOrderNote ? (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <input
            ref={orderNoteRef}
            type="text"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onBlur={saveOrderNote}
            onKeyDown={(e) => { if (e.key === 'Enter') saveOrderNote(); if (e.key === 'Escape') setEditingOrderNote(false) }}
            placeholder="Add order note…"
            className="flex-1 text-xs bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditingOrderNote(true)}
          className="w-full flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <FileText className={cn('w-3.5 h-3.5 shrink-0', orderNotes ? 'text-orange-400' : 'text-gray-300 dark:text-gray-600')} />
          <span className={cn('text-xs truncate', orderNotes ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-600')}>
            {orderNotes || 'Add note…'}
          </span>
          {orderNotes && (
            <button
              onClick={(e) => { e.stopPropagation(); setOrderNotes(''); if (localOrderId) ipc.order.updateNotes(localOrderId, null).catch(() => {}) }}
              className="ml-auto text-gray-300 hover:text-red-400 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </button>
      )}

      {/* Lines */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 text-sm">
            <p>Cart is empty</p>
            <p className="text-xs mt-1">Click items to add</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {lines.map((line) => {
              const isPending = line.kotStatus === 'pending'
              const hasNote = !!line.notes
              const noteOpen = openNoteId === line.id
              return (
                <div key={line.id}>
                  <div  className="px-3 py-3 flex gap-2">
                  {/* Left: item details + qty controls + note input */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{line.name}</p>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', kotStatusColor(line.kotStatus))}>
                        {line.kotStatus === 'pending' ? 'new' : line.kotStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">₹{line.rate} × {line.quantity} = ₹{(line.rate * line.quantity).toFixed(2)}</p>
                    {!isPending && hasNote && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 italic truncate">{line.notes}</p>
                    )}
                    {/* <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() => updateQty(line.id, line.quantity - 1)}
                        disabled={!isPending}
                        className="w-7 h-7 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-gray-800 dark:text-gray-100">{line.quantity}</span>
                      <button
                        onClick={() => updateQty(line.id, line.quantity + 1)}
                        disabled={!isPending}
                        className="w-7 h-7 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div> */}

                  </div>

                  {/* Right: action buttons */}
                  <div className="flex justify-start gap-2 shrink-0">
                    {isPending && (
                      <button
                        onClick={() => setOpenNoteId(noteOpen ? null : line.id)}
                        title="Chef note"
                        className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                          hasNote || noteOpen
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700',
                        )}
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(line.id)}
                      disabled={!isPending}
                      className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  </div>
                  <div>                    {isPending && noteOpen && (
                      <textarea
                        ref={noteInputRef}
                        value={line.notes}
                        onChange={(e) => {
                          const val = e.target.value
                          setLineNotes(line.id, val)
                          ipc.order.updateLineNotes(line.id, val || null).catch(() => {})
                        }}
                        placeholder="Note for chef…"
                        rows={2}
                        className="mt-2 w-full text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    )}
                    </div>
                </div>
              )
            })}
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
      <div className="p-3 flex flex-col gap-2 border-t border-gray-100 dark:border-gray-700">

        {/* Row 1: KOT Display + KOT Print — dine_in only */}
        {orderType === 'dine_in' && (
          <div className="flex gap-2">
            <button
              onClick={onKotDisplay}
              disabled={pendingLines.length === 0 || sendingKot}
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-100 font-medium rounded-xl transition-colors"
              style={{ minHeight: 56 }}
            >
              {sendingKot
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Monitor className="w-4 h-4" />}
              <span className="text-xs">
                KOT Display{pendingLines.length > 0 ? ` (${pendingLines.length})` : ''}
              </span>
            </button>

            <button
              onClick={onSendKot}
              disabled={pendingLines.length === 0 || sendingKot}
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-xl transition-colors"
              style={{ minHeight: 56 }}
            >
              {sendingKot
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              <span className="text-xs">
                KOT Print{pendingLines.length > 0 ? ` (${pendingLines.length})` : ''}
              </span>
            </button>
          </div>
        )}

        {/* Row 2: Charge — full width, primary action */}
        <button
          onClick={onCharge}
          disabled={isEmpty || (orderType === 'dine_in' && !hasSentLines && pendingLines.length > 0)}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-xl transition-colors text-base"
          style={{ minHeight: 60 }}
        >
          <CreditCard className="w-5 h-5" />
          Charge {!isEmpty && formatCurrency(totals.netPayable)}
        </button>

        {/* Row 3: Hold Order + Invoice Print */}
        <div className="flex gap-2">
          <button
            onClick={onHold}
            disabled={!onHold || isEmpty || holdingOrder}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
            style={{ minHeight: 56 }}
          >
            {holdingOrder
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <PauseCircle className="w-4 h-4" />}
            <span className="text-xs">Hold Order</span>
          </button>

          <button
            onClick={onPrint}
            disabled={!onPrint || isEmpty}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
            style={{ minHeight: 56 }}
          >
            <Printer className="w-4 h-4" />
            <span className="text-xs">Invoice Print</span>
          </button>
        </div>

      </div>

    </div>
  )
}
