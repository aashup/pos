import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ipc, type LocalCustomer } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'

const SYNC_BADGE: Record<string, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  synced:  { label: 'Synced',  classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  failed:  { label: 'Failed',  classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

export default function CustomerManager() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<LocalCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const rows = await ipc.customer.search(q)
      setCustomers(rows)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query, load])

  const handleAdded = (c: LocalCustomer) => {
    setCustomers((prev) => [c, ...prev])
    setAddOpen(false)
    toast.success(`Customer "${c.name}" added`)
  }

  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title="Customers" onBack={() => navigate('/pos/billing')} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className={cn('px-6 py-3 border-b flex items-center gap-3', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className={cn('flex items-center gap-2 flex-1 rounded-lg px-3 py-2 border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
            <Search className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone…"
              className={cn('flex-1 text-sm bg-transparent outline-none placeholder-gray-400', isDark ? 'text-gray-200' : 'text-gray-800')}
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </button>
        </div>

        {/* List */}
        <div className={cn('flex-1 overflow-y-auto p-6', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className={cn('flex flex-col items-center justify-center py-20 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">{query ? 'No customers match your search.' : 'No customers yet.'}</p>
              {!query && <p className="text-xs mt-1">Click "Add Customer" to get started.</p>}
            </div>
          ) : (
            <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-800' : 'border-gray-200')}>
              {customers.map((c, i) => {
                const badge = SYNC_BADGE[c.sync_status] ?? SYNC_BADGE.pending
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3.5',
                      i !== customers.length - 1 && (isDark ? 'border-b border-gray-800' : 'border-b border-gray-100'),
                      isDark ? 'bg-gray-900' : 'bg-white',
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600')}>
                      {initials(c.name)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-200' : 'text-gray-800')}>{c.name}</p>
                      {c.phone && <p className={cn('text-xs truncate', isDark ? 'text-gray-400' : 'text-gray-400')}>{c.phone}</p>}
                    </div>
                    {/* Sync badge */}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', badge.classes)}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {!loading && customers.length > 0 && (
            <p className={cn('text-xs text-center mt-4', isDark ? 'text-gray-600' : 'text-gray-400')}>
              {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {addOpen && (
        <AddCustomerModal
          isDark={isDark}
          onClose={() => setAddOpen(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

function AddCustomerModal({
  isDark,
  onClose,
  onAdded,
}: {
  isDark: boolean
  onClose: () => void
  onAdded: (c: LocalCustomer) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { setNameError('Name is required'); return }
    setNameError('')
    setSaving(true)
    try {
      const c = await ipc.customer.create(name.trim(), phone.trim() || undefined)
      onAdded(c)
    } catch {
      toast.error('Failed to add customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className={cn('rounded-2xl shadow-xl w-full max-w-sm', isDark ? 'bg-gray-900' : 'bg-white')}>
        <div className={cn('flex items-center justify-between px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <h3 className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>Add Customer</h3>
          <button onClick={onClose} className={cn('transition-colors', isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder="Customer name"
              className={cn(
                'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400',
                isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'border-gray-300 bg-white placeholder-gray-400',
                nameError && 'border-red-400 focus:ring-red-400',
              )}
            />
            {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
          </div>
          <div>
            <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Phone <span className={cn('font-normal', isDark ? 'text-gray-500' : 'text-gray-400')}>(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder="e.g. 9876543210"
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'border-gray-300 bg-white placeholder-gray-400')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className={cn('px-4 py-2 text-sm', isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800')}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Adding…' : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
