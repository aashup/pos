import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import {
  RotateCw, LogOut, Menu, X,
  TableIcon, BarChart2, ChefHat, Info, Printer, FileText,
  Download, ClipboardList, PauseCircle, Package, Settings,
  Sun, Moon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useCartStore } from '../../store/cartStore'
import { useTablesStore } from '../../store/tablesStore'
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { ordersApi } from '../../api/orders'
import { ipc } from '../../bridge/ipc'
import { formatCurrency, cn } from '../../lib/utils'
import ItemGrid from '../../components/pos/ItemGrid'
import Cart from '../../components/pos/Cart'
import PaymentModal from '../../components/pos/PaymentModal'
import type { Item } from '../../types'

export default function BillingScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { orderId, localOrderId, orderType, tableId, totals, lines, setLocalOrder, setOrder, clearOrder, populateLines } = useCartStore()
  const { updateTableStatus } = useTablesStore()
  const { status: syncStatus } = useSyncStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [sendingKot, setSendingKot] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [holdingOrder, setHoldingOrder] = useState(false)

  // ── Resume existing order ────────────────────────────────────────────────────
  // Runs once per mount. If cart is already populated (same session) it skips.
  // Otherwise: try SQLite by tableId (offline-first), then fall back to API.
  const orderLoadedRef = useRef(false)

  useEffect(() => {
    // Already have live data from this session — nothing to load
    if (localOrderId && lines.length > 0) { orderLoadedRef.current = true; return }
    // Already loaded, or genuinely new blank order with no context
    if (orderLoadedRef.current || (!tableId && !orderId)) return

    orderLoadedRef.current = true

    const loadExistingOrder = async () => {
      // Step 1: Try local SQLite (works offline)
      if (tableId) {
        const local = await ipc.order.findByTable(tableId)
        if (local && local.lines.length > 0) {
          const cartLines = local.lines.map((l) => ({
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
          populateLines(cartLines, local.id)
          return
        }
      }

      // Step 2: Fall back to API (needed for orders from another device)
      if (orderId && !localOrderId) {
        try {
          const res = await ordersApi.get(orderId)
          const order = res.data?.data
          if (order?.lines?.length) {
            const cartLines = order.lines.map((l: any) => ({
              id: l.id,
              itemId: l.item_id ?? '',
              comboId: l.combo_id ?? null,
              name: l.item?.name ?? l.item_name ?? 'Item',
              rate: l.rate,
              unit: l.item?.unit ?? 'PCS',
              gstRate: l.gst_rate ?? 0,
              quantity: l.quantity,
              discountPct: l.discount_percent ?? 0,
              modifiersTotal: l.modifiers_total ?? 0,
              kotStatus: l.kot_status as 'pending' | 'sent' | 'cooking' | 'ready' | 'served',
              notes: l.notes ?? '',
              variantId: l.item_variant_id ?? null,
              variantName: null,
              selectedModifiers: [],
            }))
            populateLines(cartLines, undefined, true)
          }
        } catch {
          // Offline and no local copy — blank cart is acceptable
        }
      }
    }

    loadExistingOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, orderId])

  const handleOrderTypeChange = async (type: 'takeaway' | 'dine_in' | 'delivery') => {
    if (type === 'dine_in') {
      navigate('/pos/tables')
      return
    }
    // Create local SQLite order immediately (offline-first)
    try {
      const localId = await ipc.order.create({ order_type: type })
      setLocalOrder(localId, type)
    } catch {
      toast.error('Failed to create order')
    }
  }

  /**
   * Add item to cart and persist to SQLite (offline-first).
   * For occupied/resumed dine-in (orderId = server UUID), SQLite write is skipped.
   */
  const handleAddItem = useCallback((item: Item & { selling_price: number }) => {
    const state = useCartStore.getState()
    const { localOrderId: lid, lines: currentLines } = state

    // Check if same pending bare item already exists → will increment qty
    const existing = currentLines.find(
      (l) => l.itemId === item.id && !l.variantId && l.selectedModifiers.length === 0 && l.kotStatus === 'pending',
    )

    if (existing) {
      const newQty = existing.quantity + 1
      if (lid) ipc.order.updateLineQty(existing.id, newQty).catch(() => {})
      state.updateQty(existing.id, newQty)
    } else {
      const lineId = uuidv4()
      if (lid) {
        ipc.order.addLine(lid, {
          id: lineId,
          item_id: item.id,
          item_name: item.name,
          quantity: 1,
          rate: item.selling_price ?? 0,
          discount_percent: 0,
          gst_rate: (item.cgst ?? 0) + (item.sgst ?? 0) + (item.igst ?? 0),
          notes: null,
        }).catch(() => {})
      }
      state.addItem({ ...item, selling_price: item.selling_price ?? 0 }, lineId)
    }
  }, [])

  const handleSendKot = useCallback(async () => {
    const pendingLines = lines.filter((l) => l.kotStatus === 'pending')
    if (sendingKot || pendingLines.length === 0) return

    setSendingKot(true)
    try {
      if (localOrderId) {
        // Offline-first: create local KOT, print, push to server in background
        const result = await ipc.order.sendKot(localOrderId)
        if (!result.success) {
          toast.error(result.error ?? 'No pending items')
          return
        }
        toast.success(`KOT ${result.kotNumber ?? ''} sent to kitchen`)
        useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
        if (tableId) updateTableStatus(tableId, 'occupied', localOrderId)
      } else if (orderId) {
        // Resumed occupied table — only push NEW lines (not server-native ones that already exist)
        const newLines = pendingLines.filter((l) => !l.isServerNative)
        if (newLines.length > 0) {
          await ordersApi.addLines(
            orderId,
            newLines.map((l) => ({
              item_id: l.itemId,
              quantity: l.quantity,
              rate: l.rate,
              discount_percent: l.discountPct,
              gst_rate: l.gstRate,
              notes: l.notes || undefined,
            })),
          )
        }
        const res = await ordersApi.sendKot(orderId)
        const kot = res.data?.data
        toast.success(`KOT ${kot?.kot_number ?? ''} sent to kitchen`)
        useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
        if (tableId) updateTableStatus(tableId, 'occupied', orderId)
      } else {
        toast.error('No active order. Select a table or choose an order type.')
      }
    } catch {
      toast.error('Failed to send KOT')
    } finally {
      setSendingKot(false)
    }
  }, [orderId, localOrderId, lines])

  const handleHoldOrder = useCallback(async () => {
    if (!orderId || orderId.startsWith('local-')) { toast.error('No active server order to hold'); return }
    setHoldingOrder(true)
    try {
      await ordersApi.hold(orderId)
      clearOrder()
      toast.success('Order placed on hold')
    } catch {
      toast.error('Failed to hold order')
    } finally {
      setHoldingOrder(false)
    }
  }, [orderId, clearOrder])

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const result = await ipc.sync.trigger() as { errors?: string[]; pulled?: number; pushed?: number }
      const errors = result?.errors ?? []
      if (errors.length > 0) {
        toast.error(`Sync error: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`, { duration: 6000 })
      } else {
        toast.success(`Synced${result?.pulled ? ` — ${result.pulled} records` : ''}`)
      }
    } catch (e: unknown) {
      toast.error(`Sync failed: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  // Auto-updater notifications
  useEffect(() => {
    if (typeof window.electronAPI === 'undefined') return
    const unsubDownloaded = ipc.updater.onUpdateDownloaded(() => setUpdateReady(true))
    return unsubDownloaded
  }, [])

  // Keyboard shortcut events — dispatched by the global useKeyboardShortcuts hook in AppRoutes
  useEffect(() => {
    const onSendKot = () => { if (orderType === 'dine_in') handleSendKot() }
    const onPayment  = () => { if (lines.length > 0) setShowPayment(true) }
    const onEscape   = () => { setDrawerOpen(false); setShowPayment(false) }

    window.addEventListener('shortcut:send-kot', onSendKot)
    window.addEventListener('shortcut:payment',  onPayment)
    window.addEventListener('shortcut:escape',   onEscape)
    return () => {
      window.removeEventListener('shortcut:send-kot', onSendKot)
      window.removeEventListener('shortcut:payment',  onPayment)
      window.removeEventListener('shortcut:escape',   onEscape)
    }
  }, [orderType, handleSendKot, lines.length])

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      {/* Top bar */}
      <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
            title="Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Zazzy POS</span>
          <div className="flex gap-1">
            {(['takeaway', 'dine_in', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleOrderTypeChange(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  orderType === t
                    ? 'bg-orange-500 text-white'
                    : isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {t === 'dine_in' ? 'Dine In' : t === 'takeaway' ? 'Takeaway' : 'Delivery'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className={`flex items-center gap-1.5 text-xs ${
              syncStatus === 'error'
                ? 'text-red-500 hover:text-red-400'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
            title={syncStatus === 'error' ? 'Sync had errors — click to retry (F5)' : 'F5'}
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : 'Sync'}
            {syncStatus === 'error' && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            )}
          </button>
          <span className={isDark ? 'text-gray-400 text-xs' : 'text-gray-600 text-xs'}>{user?.name}</span>
          <button onClick={logout} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className={cn('flex-1 overflow-hidden', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          <ItemGrid onItemAdd={handleAddItem} />
        </div>
        <div className="w-80 xl:w-96 shrink-0">
          <Cart
            onSendKot={handleSendKot}
            onCharge={() => setShowPayment(true)}
            onHold={orderId && !orderId.startsWith('local-') ? handleHoldOrder : undefined}
            sendingKot={sendingKot}
            holdingOrder={holdingOrder}
          />
        </div>
      </div>

      {/* Update banner */}
      {updateReady && (
        <div className="bg-blue-600 text-white text-xs flex items-center justify-between px-4 py-2 shrink-0">
          <span className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5" />
            A new version is ready to install.
          </span>
          <button
            onClick={() => ipc.updater.installNow()}
            className="bg-white text-blue-700 font-semibold px-3 py-1 rounded-lg hover:bg-blue-50 text-xs"
          >
            Restart & Update
          </button>
        </div>
      )}

      {/* Keyboard shortcut hint bar */}
      <div className={cn('h-7 flex items-center px-4 gap-6 shrink-0', isDark ? 'bg-gray-900' : 'bg-gray-100')}>
        <ShortcutHint keys="F1" label="Tables" isDark={isDark} />
        <ShortcutHint keys="F2" label="Search" isDark={isDark} />
        {orderType === 'dine_in' && <ShortcutHint keys="F3" label="Send KOT" isDark={isDark} />}
        <ShortcutHint keys="F4" label="Charge" isDark={isDark} />
        <ShortcutHint keys="F5" label="Sync" isDark={isDark} />
        <ShortcutHint keys="Esc" label="Close" isDark={isDark} />
      </div>

      {/* Side drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className={cn('fixed left-0 top-0 h-full w-64 z-50 flex flex-col shadow-2xl', isDark ? 'bg-gray-900 text-white border-r border-gray-800' : 'bg-white text-gray-900 border-r border-gray-200')}>
            <div className={cn('flex items-center justify-between p-4 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}>
              <span className="font-bold text-orange-400">Navigation</span>
              <button onClick={() => setDrawerOpen(false)} className={cn('', isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className={cn('flex-1 p-3 space-y-1', isDark ? 'bg-gray-900' : 'bg-white')}>
              <DrawerLink icon={TableIcon}    label="Table Map"      onClick={() => { setDrawerOpen(false); navigate('/pos/tables') }} isDark={isDark} />
              <DrawerLink icon={ChefHat}     label="Kitchen Window" onClick={() => { setDrawerOpen(false); ipc.window.openKitchen() }} isDark={isDark} />
              <DrawerLink icon={ClipboardList} label="Order History" onClick={() => { setDrawerOpen(false); navigate('/pos/orders') }} isDark={isDark} />
              <DrawerLink icon={PauseCircle} label="Held Orders"    onClick={() => { setDrawerOpen(false); navigate('/pos/hold') }} isDark={isDark} />
              <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
              <DrawerLink icon={Package}   label="Items"          onClick={() => { setDrawerOpen(false); navigate('/inventory/items') }} isDark={isDark} />
              <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
              <DrawerLink icon={BarChart2} label="Sales Summary"  onClick={() => { setDrawerOpen(false); navigate('/reports/sales') }} isDark={isDark} />
              <DrawerLink icon={FileText} label="Item-Wise Sales" onClick={() => { setDrawerOpen(false); navigate('/reports/items') }} isDark={isDark} />
              <DrawerLink icon={BarChart2} label="Day Close"      onClick={() => { setDrawerOpen(false); navigate('/reports/day-close') }} isDark={isDark} />
              <DrawerLink icon={FileText} label="GST Summary"     onClick={() => { setDrawerOpen(false); navigate('/reports/gst') }} isDark={isDark} />
              <div className={cn('my-2 border-t', isDark ? 'border-gray-800' : 'border-gray-200')} />
              <DrawerLink icon={Settings} label="Table Manager"    onClick={() => { setDrawerOpen(false); navigate('/settings/tables') }} isDark={isDark} />
              <DrawerLink icon={Printer} label="Printer Settings" onClick={() => { setDrawerOpen(false); navigate('/settings/printer') }} isDark={isDark} />
              <DrawerLink icon={Info}    label="Device Info"      onClick={() => { setDrawerOpen(false); navigate('/settings/device') }} isDark={isDark} />
            </nav>
            <div className={cn('p-4 border-t', isDark ? 'border-gray-800' : 'border-gray-200')}>
              <p className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>Zazzy POS v1.0.0</p>
            </div>
          </div>
        </>
      )}

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          orderId={orderId}
          localOrderId={localOrderId}
          orderType={orderType}
          lines={lines}
          totals={totals}
          onClose={() => setShowPayment(false)}
          onSuccess={(serverId?: string) => {
            setShowPayment(false)
            // Mark local SQLite order as confirmed so SyncWorker skips re-push
            if (localOrderId) ipc.order.markConfirmed(localOrderId, serverId).catch(() => {})
            // Free the table before clearing cart (tableId lives in cartStore)
            if (tableId && orderType === 'dine_in') {
              updateTableStatus(tableId, 'vacant', null)
            }
            clearOrder()
            toast.success('Payment complete!')
            navigate('/pos/tables')
          }}
        />
      )}
    </div>
  )
}

function ShortcutHint({ keys, label, isDark }: { keys: string; label: string; isDark: boolean }) {
  return (
    <span className={cn('flex items-center gap-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-600')}>
      <kbd className={cn('px-1 py-0.5 rounded text-xs font-mono', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>{keys}</kbd>
      {label}
    </span>
  )
}

function DrawerLink({ icon: Icon, label, onClick, isDark }: { icon: React.ElementType; label: string; onClick: () => void; isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left', isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  )
}
