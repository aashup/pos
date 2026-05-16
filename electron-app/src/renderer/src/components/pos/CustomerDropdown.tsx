import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, UserPlus, X } from 'lucide-react'
import { ipc, type LocalCustomer } from '../../bridge/ipc'

interface CustomerDropdownProps {
  onClose: () => void
  onSelect: (id: string, name: string) => void
}

export default function CustomerDropdown({ onClose, onSelect }: CustomerDropdownProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocalCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    searchRef.current?.focus()
    ipc.customer.search('').then(setResults).catch(() => setResults([]))
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await ipc.customer.search(query.trim())
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleAdd = useCallback(async () => {
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }
    setNameError('')
    setSaving(true)
    try {
      const customer = await ipc.customer.create(name.trim(), phone.trim() || undefined)
      onSelect(customer.id, customer.name)
    } catch {
      // silent — unlikely to fail on local SQLite write
    } finally {
      setSaving(false)
    }
  }, [name, phone, onSelect])

  const handleSelectResult = (c: LocalCustomer) => {
    onSelect(c.id, c.name)
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1e2130] rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ minWidth: 220 }}
    >
      {/* Header: search + close */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-300 flex-1">Add Customer</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            placeholder="Search by name or phone..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-white/10 text-gray-100 placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="max-h-36 overflow-y-auto border-b border-white/10">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectResult(c)}
              className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors"
            >
              <p className="text-xs font-medium text-gray-100">{c.name}</p>
              {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Quick-add form */}
      <div className="px-3 pb-3 pt-2 space-y-2">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
            placeholder="Customer name *"
            className={`w-full px-3 py-2 text-xs rounded-lg bg-white/10 text-gray-100 placeholder-gray-400 border focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
              nameError ? 'border-red-400' : 'border-white/10'
            }`}
          />
          {nameError && <p className="text-xs text-red-400 mt-0.5">{nameError}</p>}
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full px-3 py-2 text-xs rounded-lg bg-white/10 text-gray-100 placeholder-gray-400 border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
