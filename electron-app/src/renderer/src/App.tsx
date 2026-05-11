import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { useSyncStore } from './store/syncStore'
import { useThemeStore, applyTheme } from './store/themeStore'
import { ipc } from './bridge/ipc'

// Apply persisted theme before first render
applyTheme(useThemeStore.getState().theme)

// Subscribe to theme changes and apply globally
useThemeStore.subscribe(
  (state) => state.theme,
  (theme) => applyTheme(theme),
)

import toast, { Toaster } from 'react-hot-toast'

// Pages
import Login from './pages/auth/Login'
import SetupWizard from './pages/setup/SetupWizard'
import BillingScreen from './pages/pos/BillingScreen'
import TableSelection from './pages/pos/TableSelection'
import KitchenDisplay from './pages/kitchen/KitchenDisplay'
import SalesSummary from './pages/reports/SalesSummary'
import DayClose from './pages/reports/DayClose'
import ItemWise from './pages/reports/ItemWise'
import GSTReport from './pages/reports/GSTReport'
import DeviceInfo from './pages/settings/DeviceInfo'
import PrinterSettings from './pages/settings/PrinterSettings'
import TableManager from './pages/settings/TableManager'
import OrderList from './pages/orders/OrderList'
import OrderDetail from './pages/orders/OrderDetail'
import HoldOrders from './pages/orders/HoldOrders'
import ItemList from './pages/inventory/ItemList'
import ItemDetail from './pages/inventory/ItemDetail'
import ModifierGroupManager from './pages/inventory/ModifierGroupManager'
import ComboManager from './pages/inventory/ComboManager'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, serverUrl } = useAuthStore()
  if (!serverUrl) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuthStore()
  const { setStatus, setSyncResult } = useSyncStore()

  useEffect(() => {
    if (typeof window.electronAPI === 'undefined') return
    const unsub = ipc.sync.onStatusChange((status: unknown) => {
      const s = status as { status?: string; lastSyncAt?: string; errors?: string[] }
      if (s?.status === 'syncing') {
        setStatus('syncing')
      } else {
        const errors = s?.errors ?? []
        setSyncResult({ lastSyncAt: s?.lastSyncAt ?? null, errors })
        if (errors.length > 0) {
          toast.error(`Sync error: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`, {
            id: 'sync-error',  // deduplicate — only one toast at a time
            duration: 6000,
          })
        }
      }
    })
    return unsub
  }, [setStatus, setSyncResult])

  return (
    <Routes>
      <Route path="/setup"  element={<SetupWizard />} />
      <Route path="/login"  element={<Login />} />
      <Route path="/kitchen" element={<KitchenDisplay />} />

      <Route path="/pos/billing" element={<RequireAuth><BillingScreen /></RequireAuth>} />
      <Route path="/pos/tables"  element={<RequireAuth><TableSelection /></RequireAuth>} />

      <Route path="/reports/sales"      element={<RequireAuth><SalesSummary /></RequireAuth>} />
      <Route path="/reports/day-close"  element={<RequireAuth><DayClose /></RequireAuth>} />
      <Route path="/reports/items"      element={<RequireAuth><ItemWise /></RequireAuth>} />
      <Route path="/reports/gst"        element={<RequireAuth><GSTReport /></RequireAuth>} />

      <Route path="/pos/orders"         element={<RequireAuth><OrderList /></RequireAuth>} />
      <Route path="/pos/orders/:id"    element={<RequireAuth><OrderDetail /></RequireAuth>} />
      <Route path="/pos/hold"          element={<RequireAuth><HoldOrders /></RequireAuth>} />

      <Route path="/inventory/items"         element={<RequireAuth><ItemList /></RequireAuth>} />
      <Route path="/inventory/items/:id"     element={<RequireAuth><ItemDetail /></RequireAuth>} />
      <Route path="/inventory/modifiers"     element={<RequireAuth><ModifierGroupManager /></RequireAuth>} />
      <Route path="/inventory/combos"        element={<RequireAuth><ComboManager /></RequireAuth>} />

      <Route path="/settings/device"   element={<RequireAuth><DeviceInfo /></RequireAuth>} />
      <Route path="/settings/printer"  element={<RequireAuth><PrinterSettings /></RequireAuth>} />
      <Route path="/settings/tables"   element={<RequireAuth><TableManager /></RequireAuth>} />

      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/pos/billing' : '/login'} replace />}
      />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { fontSize: '13px', maxWidth: '420px' },
            error: { duration: 6000 },
            success: { duration: 2500 },
          }}
        />
      </HashRouter>
    </QueryClientProvider>
  )
}
