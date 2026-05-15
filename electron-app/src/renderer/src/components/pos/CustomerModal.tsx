import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Loader2, Search, UserPlus, X } from 'lucide-react'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nameError, setNameError] = useState('')
  const [creating, setCreating] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

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
        address: address.trim() || undefined,
      })
      onSelect(party.id, party.name)
    } catch {
      // error toast handled by api client
    } finally {
      setCreating(false)
    }
  }

  const switchToCreate = () => {
    setName(query)
    setMode('create')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {mode === 'create' && (
              <button
                onClick={() => setMode('search')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
              {mode === 'search' ? 'Add Customer' : 'New Customer'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'search' ? (
          <div>
            {/* Search input */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-64 overflow-y-auto">
              {!searched && !searching && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
                  Type to search customers
                </p>
              )}

              {searched && results.length === 0 && !searching && (
                <div className="py-6 flex flex-col items-center gap-3">
                  <p className="text-sm text-gray-400 dark:text-gray-500">No customers found</p>
                  <button
                    onClick={switchToCreate}
                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create "{query}"
                  </button>
                </div>
              )}

              {results.map((party) => (
                <button
                  key={party.id}
                  onClick={() => onSelect(party.id, party.name)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{party.name}</p>
                  {(party.phone || party.address) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {[party.phone, party.address].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {/* Create new footer */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={switchToCreate}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Create new customer
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError('') }}
                placeholder="Customer name"
                autoFocus
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  nameError ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600'
                }`}
              />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mobile</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address (optional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {creating ? 'Saving…' : 'Save Customer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
