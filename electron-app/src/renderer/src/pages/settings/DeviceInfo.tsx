import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ipc } from '../../bridge/ipc'
import { useAuthStore } from '../../store/authStore'
import { useSyncStore } from '../../store/syncStore'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'

export default function DeviceInfo() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { user, serverUrl } = useAuthStore()
  const { status, lastSyncAt } = useSyncStore()
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    ipc.auth.getDeviceId().then(setDeviceId)
  }, [])

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title="Device Info" />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <InfoCard label="Server URL" value={serverUrl ?? '—'} isDark={isDark} onCopy={serverUrl ? () => copy(serverUrl) : undefined} copied={copied} />
        <InfoCard label="Device ID" value={deviceId ?? '…'} isDark={isDark} onCopy={deviceId ? () => copy(deviceId) : undefined} copied={copied} />
        <InfoCard label="Logged in as" value={user ? `${user.name} (${user.role})` : '—'} isDark={isDark} />
        <InfoCard label="Company" value={user?.company?.name ?? '—'} isDark={isDark} />
        <InfoCard
          label="Sync Status"
          value={status === 'syncing' ? 'Syncing…' : lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : 'Never synced'}
          isDark={isDark}
        />
        <InfoCard label="App Version" value="1.0.0" isDark={isDark} />
      </div>
    </div>
  )
}

function InfoCard({
  label, value, isDark, onCopy, copied,
}: {
  label: string; value: string; isDark: boolean; onCopy?: () => void; copied?: boolean
}) {
  return (
    <div className={cn('rounded-xl p-4 flex items-center justify-between', isDark ? 'bg-gray-900' : 'bg-white')}>
      <div>
        <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{label}</p>
        <p className={cn('text-sm font-medium mt-0.5 break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>{value}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className={cn('ml-3 shrink-0', isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')}>
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}
