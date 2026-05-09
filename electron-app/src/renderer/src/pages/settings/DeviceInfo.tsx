import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ipc } from '../../bridge/ipc'
import { useAuthStore } from '../../store/authStore'
import { useSyncStore } from '../../store/syncStore'

export default function DeviceInfo() {
  const navigate = useNavigate()
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
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-orange-400 text-sm">Device Info</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <InfoCard label="Server URL" value={serverUrl ?? '—'} onCopy={serverUrl ? () => copy(serverUrl) : undefined} copied={copied} />
        <InfoCard label="Device ID" value={deviceId ?? '…'} onCopy={deviceId ? () => copy(deviceId) : undefined} copied={copied} />
        <InfoCard label="Logged in as" value={user ? `${user.name} (${user.role})` : '—'} />
        <InfoCard label="Company" value={user?.company?.name ?? '—'} />
        <InfoCard
          label="Sync Status"
          value={status === 'syncing' ? 'Syncing…' : lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : 'Never synced'}
        />
        <InfoCard label="App Version" value="1.0.0" />
      </div>
    </div>
  )
}

function InfoCard({
  label, value, onCopy, copied,
}: {
  label: string; value: string; onCopy?: () => void; copied?: boolean
}) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5 break-all">{value}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="ml-3 text-gray-400 hover:text-gray-600 shrink-0">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}
