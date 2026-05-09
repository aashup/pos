import { useState, useEffect, useCallback } from 'react'
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
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { ordersApi } from '../../api/orders'
import { ipc } from '../../bridge/ipc'
import { formatCurrency, cn } from '../../lib/utils'
import ItemGrid from '../../components/pos/ItemGrid'
import Cart from '../../components/pos/Cart'
import PaymentModal from '../../components/pos/PaymentModal'

export default function BillingScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { orderId, orderType, tableId, totals, lines, setOrder, clearOrder } = useCartStore()
  const { status: syncStatus } = useSyncStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [sendingKot, setSendingKot] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [holdingOrder, setHoldingOrder] = useState(false)

  const handleOrderTypeChange = async (type: 'takeaway' | 'dine_in' | 'delivery') => {
    if (type === 'dine_in') {
      navigate('/pos/tables')
      return
    }
    try {
      const res = await ordersApi.create({ order_type: type })
      const order = res.data?.data
      setOrder(order.id, type)
    } catch {
      setOrder('local-' + Date.now(), type)
    }
  }

  const handleSendKot = useCallback(async () => {
    if (!orderId) {
      toast.error('No active order. Select a table or start a takeaway order.')
      return
    }
    const pendingLines = lines.filter((l) => l.kotStatus === 'pending')
    if (pendingLines.length === 0) return

    setSendingKot(true)
    try {
      let activeOrderId = orderId
      if (orderId.startsWith('local-')) {
        const res = await ordersApi.create({ order_type: orderType, table_id: tableId ?? undefined })
        activeOrderId = res.data?.data?.id
        setOrder(activeOrderId, orderType, tableId ?? undefined)
        await ordersApi.addLines(
          activeOrderId,
          pendingLines.map((l) => ({
            item_id: l.itemId,
            quantity: l.quantity,
            rate: l.rate,
            discount_percent: l.discountPct,
            gst_rate: l.gstRate,
            notes: l.notes || undefined,
          })),
        )
      }
      const res = await ordersApi.sendKot(activeOrderId)
      const kot = res.data?.data
      toast.success(`KOT ${kot?.kot_number ?? ''} sent to kitchen`)
      useCartStore.getState().markLinesSent(pendingLines.map((l) => l.id))
    } catch {
      toast.error('Failed to send KOT')
    } finally {
      setSendingKot(false)
    }
  }, [orderId, lines, orderType, tableId, setOrder])

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
      await ipc.sync.trigger()
      toast.success('Sync complete')
    } catch {
      toast.error('Sync failed')
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          navigate('/pos/tables')
          break
        case 'F3':
          e.preventDefault()
          if (orderType === 'dine_in') handleSendKot()
          break
        case 'F4':
          e.preventDefault()
          if (lines.length > 0) setShowPayment(true)
          break
        case 'F5':
          e.preventDefault()
          handleSyncNow()
          break
        case 'Escape':
          setDrawerOpen(false)
          setShowPayment(false)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, handleSendKot, lines.length, orderType])

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      {/* Top bar */}
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-gray-400 hover:text-white"
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
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
            className="text-gray-400 hover:text-white"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-1 text-gray-400 hover:text-white text-xs"
            title="F5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? 'Syncing…' : 'Sync'}
          </button>
          <span className="text-gray-400 text-xs">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className={cn('flex-1 overflow-hidden', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          <ItemGrid />
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
          orderType={orderType}
          lines={lines}
          totals={totals}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            clearOrder()
            toast.success('Payment complete!')
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
