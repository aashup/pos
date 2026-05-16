import { useState, useEffect, useRef } from 'react'
import { Loader2, Search, UserPlus, X, UserCheck } from 'lucide-react'
import { partiesApi, type Party } from '../../api/parties'

interface CustomerModalProps {
  onClose: () => void
  onSelect: (id: string, name: string) => void
}

type Mode = 'search' | 'create'

export default function CustomerModal({ onClose, onSelect }: CustomerModalProps) {
  const [mode, setMode] = useState<Mode>('search')

  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Party[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // Create state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState('')
  const [creating, setCreating] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus search on open
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Use capture so we catch the event before the trigger button's onClick re-opens it
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [onClose])

  // Debounced search
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([])
      setSearched(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await partiesApi.search(query.trim())
        setResults(data)
        setSearched(true)
      } catch {
        setResults([])
        setSearched(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const switchToCreate = () => {
    setName(query)
    setPhone('')
    setNameError('')
    setMode('create')
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }
    setNameError('')
    setCreating(true)
    try {
      const party = await partiesApi.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
      })
      onSelect(party.id, party.name)
    } catch {
      // error toast handled by api client
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 z-50 mt-1 w-72 rounded-xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Walk-In default option — always visible */}
      <button
        onClick={() => onSelect('walk_in', 'Walk-In')}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 active:bg-orange-100 transition-colors"
      >
        <UserCheck className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Walk-in Customer</span>
      </button>

      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          placeholder="Search by name or phone..."
          className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
        />
        {searching ? (
          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />
        ) : (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search results */}
      {query.trim().length > 0 && (
        <div className="max-h-44 overflow-y-auto">
          {searched && results.length === 0 && !searching && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
              No customers found
            </p>
          )}
          {results.map((party) => (
            <button
              key={party.id}
              onClick={() => onSelect(party.id, party.name)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{party.name}</p>
              {party.phone && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{party.phone}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {mode === 'create' && (
        <div className="px-3 py-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Customer name *"
              autoFocus
              className={`w-full px-3 py-2 text-sm rounded-lg border bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                nameError ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
            {nameError && <p className="text-xs text-red-500 mt-0.5 px-1">{nameError}</p>}
          </div>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Phone (optional)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={() => setMode('search')}
              className="flex-1 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {creating ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Add footer — search mode only */}
      {mode === 'search' && (
        <button
          onClick={switchToCreate}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 transition-colors border-t border-gray-100 dark:border-gray-700"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          Quick Add Customer
        </button>
      )}
    </div>
  )
}
