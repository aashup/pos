import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '../../store/cartStore'
import { useTablesStore } from '../../store/tablesStore'
import { useThemeStore } from '../../store/themeStore'
import { useOrdersStore } from '../../store/ordersStore'
import { ordersApi } from '../../api/orders'
import { ipc } from '../../bridge/ipc'
import { usePrinter } from '../../hooks/usePrinter'
import { useResizable } from '../../hooks/useResizable'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency, cn } from '../../lib/utils'
import ItemGrid from '../../components/pos/ItemGrid'
import Cart from '../../components/pos/Cart'
import PaymentModal from '../../components/pos/PaymentModal'
import PosHeader from '../../components/pos/PosHeader'
import NavigationDrawer from '../../components/pos/NavigationDrawer'
import VariantModifierModal from '../../components/pos/VariantModifierModal'
import type { POSItem } from '../../components/pos/ItemGrid'
import type { POSItemVariant } from '../../bridge/ipc'
import type { Item, SelectedModifier, ItemVariant } from '../../types'
import type { KotTemplateData } from '../../types/printing'

export default function BillingScreen() {
  const navigate = useNavigate()
  const { orderId, localOrderId, orderType, tableId, totals, lines, setLocalOrder, setOrder, clearOrder, populateLines } = useCartStore()
  const { setKotNumber, setOrderNotes } = useCartStore()
  const { updateTableStatus } = useTablesStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { printInvoice, printKOT } = usePrinter()
  const { user } = useAuthStore()
  const { width: cartWidth, startResize: startCartResize } =
    useResizable('pos.layout.cart_width', 320, 260, 520, true)
  const [sendingKot, setSendingKot] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [holdingOrder, setHoldingOrder] = useState(false)
  const [variantModalItem, setVariantModalItem] = useState<POSItem | null>(null)

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
          if (local.notes) setOrderNotes(local.notes)
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
    // Clear existing cart before switching order type
    clearOrder()
    // Create local SQLite order immediately (offline-first)
    try {
      const localId = await ipc.order.create({ order_type: type })
      setLocalOrder(localId, type)
      useOrdersStore.getState().upsertOrder({ id: localId, order_type: type, status: 'draft', pos_held: 0, grand_total: 0, computed_total: 0, pending_line_count: 0, line_count: 0, latest_kot_status: null, kot_count: 0 } as any)
    } catch {
      toast.error('Failed to create order')
    }
  }

  /**
   * Add item to cart and persist to SQLite (offline-first).
   * For occupied/resumed dine-in (orderId = server UUID), SQLite write is skipped.
   */
  const handleAddItem = useCallback((item: POSItem) => {
    // Items with variants or modifier groups require the selection modal
    if (item.has_variants > 0 || item.has_modifiers > 0) {
      setVariantModalItem(item)
      return
    }

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
          item_variant_id: null,
          modifiers_total: 0,
        }).catch(() => {})
      }
      state.addItem({ ...item, selling_price: item.selling_price ?? 0 }, lineId)
    }
  }, [])

  const handleVariantModalConfirm = useCallback((
    variant: POSItemVariant | null,
    modifiers: SelectedModifier[],
  ) => {
    if (!variantModalItem) return
    const item = variantModalItem
    setVariantModalItem(null)

    const state = useCartStore.getState()
    const { localOrderId: lid } = state
    const lineId = uuidv4()
    const rate = variant?.price_override ?? item.selling_price ?? 0
    const modifiersTotal = modifiers.reduce((s, m) => s + m.price, 0)

    if (lid) {
      ipc.order.addLine(lid, {
        id: lineId,
        item_id: item.id,
        item_name: item.name,
        quantity: 1,
        rate,
        discount_percent: 0,
        gst_rate: (item.cgst ?? 0) + (item.sgst ?? 0) + (item.igst ?? 0),
        notes: null,
        item_variant_id: variant?.id ?? null,
        modifiers_total: modifiersTotal,
      }).catch(() => {})
    }

    state.addVariantItem(item as Item, variant as ItemVariant | null, modifiers)
  }, [variantModalItem])

  // Shared KOT creation — marks lines sent, syncs to server, returns kotData for printing (or null for legacy path)
  const createKotEntry = useCallback(async (): Promise<{ kotData: KotTemplateData | null } | null> => {
    const pendingLines = lines.filter((l) => l.kotStatus === 'pending')
    if (sendingKot || pendingLines.length === 0) return null

    setSendingKot(true)
    try {
      if (localOrderId) {
        const result = await ipc.order.sendKot(localOrderId)
        if (!result.success) {
          toast.error(result.error ?? 'No pending items')
          return null
        }
        toast.success(`KOT ${result.kotNumber ?? ''} sent to kitchen`)
        useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
        if (result.kotNumber) setKotNumber(result.kotNumber)
        if (tableId) updateTableStatus(tableId, 'occupied', localOrderId)
        const os = useOrdersStore.getState()
        const curr = os.orders.find((o) => o.id === localOrderId)
        os.upsertOrder({ id: localOrderId, kot_count: (curr?.kot_count ?? 0) + 1, latest_kot_status: 'new', pending_line_count: 0 })

        if (!result.kotNumber) return { kotData: null }
        const cartState = useCartStore.getState()
        const kotData: KotTemplateData = {
          kotNumber: result.kotNumber,
          tableName: cartState.tableName ?? undefined,
          orderType: cartState.orderType,
          pax: cartState.pax ?? undefined,
          items: (result.lines as Array<{ item_name: string; quantity: number; notes?: string | null }> ?? []).map((l) => ({
            name: l.item_name,
            quantity: l.quantity,
            notes: l.notes ?? undefined,
          })),
          notes: cartState.orderNotes || undefined,
        }
        return { kotData }
      } else if (orderId) {
        const newLines = pendingLines.filter((l) => !l.isServerNative)
        if (newLines.length > 0) {
          await ordersApi.addLines(orderId, newLines.map((l) => ({
            item_id: l.itemId,
            quantity: l.quantity,
            rate: l.rate,
            discount_percent: l.discountPct,
            gst_rate: l.gstRate,
            notes: l.notes || undefined,
          })))
        }
        const res = await ordersApi.sendKot(orderId)
        const kot = res.data?.data
        toast.success(`KOT ${kot?.kot_number ?? ''} sent to kitchen`)
        useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
        if (tableId) updateTableStatus(tableId, 'occupied', orderId)
        return { kotData: null }
      } else {
        toast.error('No active order. Select a table or choose an order type.')
        return null
      }
    } catch {
      toast.error('Failed to send KOT')
      return null
    } finally {
      setSendingKot(false)
    }
  }, [orderId, localOrderId, lines, sendingKot, tableId, setKotNumber, updateTableStatus])

  // KOT Display — send KOT to kitchen display only, no print
  const handleKotDisplay = useCallback(async () => {
    const result = await createKotEntry()
    if (!result) return
    ipc.window.openKitchen()
  }, [createKotEntry])

  // KOT Print — send KOT to kitchen display and print the slip
  const handleSendKot = useCallback(async () => {
    const result = await createKotEntry()
    if (!result) return
    // ipc.window.openKitchen()
    if (result.kotData) {
      printKOT(result.kotData, { skipDuplicateCheck: true }).catch(() => {})
    }
  }, [createKotEntry, printKOT])

  const handleHoldOrder = useCallback(async () => {
    setHoldingOrder(true)
    try {
      if (localOrderId) {
        await ipc.order.hold(localOrderId)
      } else if (orderId) {
        await ordersApi.hold(orderId)
      } else {
        toast.error('No active order to hold')
        return
      }
      if (localOrderId) useOrdersStore.getState().upsertOrder({ id: localOrderId, pos_held: 1 })
      clearOrder()
      toast.success('Order placed on hold')
      navigate('/pos/tables')
    } catch {
      toast.error('Failed to hold order')
    } finally {
      setHoldingOrder(false)
    }
  }, [orderId, localOrderId, orderType, clearOrder, navigate])

  const handlePrint = useCallback(async () => {
    if (lines.length === 0) return
    const outletName = user?.name ?? 'Restaurant'
    const result = await printInvoice({
      outletName,
      invoiceNumber: localOrderId ?? orderId ?? 'DRAFT',
      invoiceDate: new Date().toLocaleDateString('en-IN'),
      orderType,
      tableName: useCartStore.getState().tableName ?? undefined,
      items: lines.map((l) => ({
        name: l.variantName ? `${l.name} (${l.variantName})` : l.name,
        quantity: l.quantity,
        rate: l.rate,
        gstRate: l.gstRate,
        lineTotal: +(l.rate * l.quantity).toFixed(2),
      })),
      subtotal: totals.subtotal,
      cgst: totals.cgstTotal,
      sgst: totals.sgstTotal,
      discount: 0,
      grandTotal: totals.netPayable,
      paymentMode: 'pending',
    })
    if (!result.success) toast.error(result.error ?? 'Print failed')
  }, [lines, totals, localOrderId, orderId, orderType, user, printInvoice])

  // Keep ordersStore total in sync as items are added/removed
  useEffect(() => {
    if (!localOrderId) return
    useOrdersStore.getState().upsertOrder({
      id: localOrderId,
      computed_total: totals.grandTotal,
      pending_line_count: lines.filter((l) => l.kotStatus === 'pending').length,
      line_count: lines.length,
    })
  }, [localOrderId, lines, totals])

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
    const onEscape   = () => { setDrawerOpen(false); setShowPayment(false); setVariantModalItem(null) }

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
      <PosHeader
        orderType={orderType}
        onOrderTypeChange={handleOrderTypeChange}
        onMenuOpen={() => setDrawerOpen(true)}
      />

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className={cn('flex-1 overflow-hidden', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          <ItemGrid onItemAdd={handleAddItem} />
        </div>
        <div
          className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-orange-400 dark:hover:bg-orange-500 active:bg-orange-500 transition-colors select-none"
          style={{ touchAction: 'none' }}
          onMouseDown={startCartResize}
          onTouchStart={startCartResize}
        />
        <div className="shrink-0" style={{ width: cartWidth }}>
          <Cart
            onSendKot={handleSendKot}
            onCharge={() => setShowPayment(true)}
            onHold={localOrderId || (orderId && !orderId.startsWith('local-')) ? handleHoldOrder : undefined}
            onPrint={handlePrint}
            onKotDisplay={handleKotDisplay}
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
      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} isDark={isDark} />

      {/* Variant / Modifier selection modal */}
      {variantModalItem && (
        <VariantModifierModal
          item={variantModalItem}
          onConfirm={handleVariantModalConfirm}
          onClose={() => setVariantModalItem(null)}
        />
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
          onSuccess={(serverId?: string, shouldPrint?: boolean) => {
            setShowPayment(false)
            if (shouldPrint) {
              // Capture cart state before clearOrder() wipes it
              const snap = useCartStore.getState()
              const outletName = user?.name ?? 'Restaurant'
              printInvoice({
                outletName,
                invoiceNumber: localOrderId ?? serverId ?? 'DRAFT',
                invoiceDate: new Date().toLocaleDateString('en-IN'),
                orderType: snap.orderType,
                tableName: snap.tableName ?? undefined,
                items: snap.lines.map((l) => ({
                  name: l.variantName ? `${l.name} (${l.variantName})` : l.name,
                  quantity: l.quantity,
                  rate: l.rate,
                  gstRate: l.gstRate,
                  lineTotal: +(l.rate * l.quantity).toFixed(2),
                })),
                subtotal: snap.totals.subtotal,
                cgst: snap.totals.cgstTotal,
                sgst: snap.totals.sgstTotal,
                discount: 0,
                grandTotal: snap.totals.netPayable,
                paymentMode: 'cash',
              }).catch(() => {})
            }
            if (localOrderId && serverId) ipc.order.markConfirmed(localOrderId, serverId).catch(() => {})
            if (localOrderId) useOrdersStore.getState().removeOrder(localOrderId)
            if (tableId && orderType === 'dine_in') updateTableStatus(tableId, 'vacant', null)
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
