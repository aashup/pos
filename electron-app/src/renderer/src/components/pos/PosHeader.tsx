import { useState } from 'react'
import { RotateCw, LogOut, Menu, Sun, Moon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { useCartStore } from '../../store/cartStore'
import { ipc } from '../../bridge/ipc'
import { cn } from '../../lib/utils'

interface PosHeaderProps {
  orderType: 'takeaway' | 'dine_in' | 'delivery'
  onOrderTypeChange: (type: 'takeaway' | 'dine_in' | 'delivery') => void
  onMenuOpen?: () => void
}

export default function PosHeader({ orderType, onOrderTypeChange, onMenuOpen }: PosHeaderProps) {
  const { user, logout } = useAuthStore()
  const { status: syncStatus } = useSyncStore()
  const { theme, toggleTheme } = useThemeStore()
  const { tableName, kotNumber, orderNotes } = useCartStore()
  const isDark = theme === 'dark'
  const [syncing, setSyncing] = useState(false)

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

  return (
    <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
      <div className="flex items-center gap-3">
        {onMenuOpen && (
          <button
            onClick={onMenuOpen}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
            title="Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <span className="font-bold text-orange-400 text-sm">Zazzy POS</span>

        {/* Active order context */}

        <div className="flex gap-1">
          {(['takeaway', 'dine_in', 'delivery'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onOrderTypeChange(t)}
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
  )
}
