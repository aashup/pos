import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Edit2, Trash2, RefreshCw, X, Image as ImageIcon, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { combosApi } from '../../api/combos'
import { itemsApi } from '../../api/items'
import { mediaApi } from '../../api/media'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { Combo, Item, MediaItem } from '../../types'

export default function ComboManager() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [search, setSearch] = useState('')
  const [showComboForm, setShowComboForm] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [comboFormData, setComboFormData] = useState({
    name: '',
    description: '',
    price: 0,
    is_active: true,
  })
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null)
  const [showItemSelection, setShowItemSelection] = useState(false)
  const [localComboItems, setLocalComboItems] = useState<
    Array<{ item_id: string; item_variant_id: string | null; quantity: number; sort_order: number }>
  >([])
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [itemPickerSearch, setItemPickerSearch] = useState('')
  const [draggedFile, setDraggedFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Fetch combos
  const { data: combos = [], isLoading, refetch } = useQuery({
    queryKey: ['combos'],
    queryFn: async () => {
      const res = await combosApi.list({ per_page: 1000 })
      return (res.data?.data ?? []) as Combo[]
    },
  })

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const res = await itemsApi.list({ per_page: 1000 })
      return (res.data?.data ?? []) as Item[]
    },
  })

  // Fetch combo images
  const { data: comboImages = {} } = useQuery({
    queryKey: ['combo-images', selectedComboId],
    queryFn: async () => {
      if (!selectedComboId) return {}
      try {
        const res = await mediaApi.getByEntity('combo', selectedComboId)
        return { [selectedComboId]: res.data?.data ?? [] }
      } catch {
        return {}
      }
    },
  })

  const filteredCombos = combos.filter((combo) =>
    combo.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCombo = combos.find((c) => c.id === selectedComboId)
  const images = (comboImages as any)[selectedComboId] || []

  useEffect(() => {
    if (selectedCombo?.combo_items) {
      setLocalComboItems(
        selectedCombo.combo_items.map((ci, idx) => ({
          item_id: ci.item_id,
          item_variant_id: ci.item_variant_id ?? null,
          quantity: ci.quantity,
          sort_order: ci.sort_order ?? idx,
        }))
      )
    } else {
      setLocalComboItems([])
    }
    setShowItemPicker(false)
    setItemPickerSearch('')
  }, [selectedComboId])

  // Save combo mutation
  const saveComboMutation = useMutation({
    mutationFn: async (data: typeof comboFormData) => {
      if (editingCombo) {
        return combosApi.update(editingCombo.id, data)
      } else {
        return combosApi.create(data)
      }
    },
    onSuccess: () => {
      toast.success(editingCombo ? 'Combo updated' : 'Combo created')
      queryClient.invalidateQueries({ queryKey: ['combos'] })
      setShowComboForm(false)
      setEditingCombo(null)
      setComboFormData({ name: '', description: '', price: 0, is_active: true })
    },
    onError: () => {
      toast.error(editingCombo ? 'Failed to update combo' : 'Failed to create combo')
    },
  })

  // Delete combo mutation
  const deleteComboMutation = useMutation({
    mutationFn: (id: string) => combosApi.delete(id),
    onSuccess: () => {
      toast.success('Combo deleted')
      queryClient.invalidateQueries({ queryKey: ['combos'] })
      setSelectedComboId(null)
    },
    onError: () => {
      toast.error('Failed to delete combo')
    },
  })

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedComboId) return
      return mediaApi.upload(file, 'combo', selectedComboId, true)
    },
    onSuccess: () => {
      toast.success('Image uploaded')
      queryClient.invalidateQueries({ queryKey: ['combo-images'] })
      setDraggedFile(null)
    },
    onError: () => {
      toast.error('Failed to upload image')
    },
  })

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => {
      toast.success('Image deleted')
      queryClient.invalidateQueries({ queryKey: ['combo-images'] })
    },
    onError: () => {
      toast.error('Failed to delete image')
    },
  })

  // Save combo items mutation
  const saveItemsMutation = useMutation({
    mutationFn: () =>
      combosApi.update(selectedComboId!, { items: localComboItems } as any),
    onSuccess: () => {
      toast.success('Items saved')
      queryClient.invalidateQueries({ queryKey: ['combos'] })
    },
    onError: () => {
      toast.error('Failed to save items')
    },
  })

  const handleCreateCombo = () => {
    setEditingCombo(null)
    setComboFormData({ name: '', description: '', price: 0, is_active: true })
    setShowComboForm(true)
  }

  const handleEditCombo = (combo: Combo) => {
    setEditingCombo(combo)
    setComboFormData({
      name: combo.name,
      description: combo.description || '',
      price: Number(combo.price),
      is_active: combo.is_active ?? true,
    })
    setShowComboForm(true)
  }

  const handleDeleteCombo = (id: string) => {
    if (confirm('Delete this combo? This action cannot be undone.')) {
      deleteComboMutation.mutate(id)
    }
  }

  const handleSaveCombo = () => {
    if (!comboFormData.name.trim()) {
      toast.error('Combo name is required')
      return
    }
    saveComboMutation.mutate(comboFormData)
  }

  const handleSelectCombo = (comboId: string) => {
    setSelectedComboId(comboId)
    setShowItemSelection(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggedFile(e.dataTransfer.files[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) {
      setUploadingImage(true)
      files.forEach(file => uploadImageMutation.mutate(file))
      setUploadingImage(false)
    } else {
      toast.error('Please drop image files')
    }
    setDraggedFile(null)
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? [])
    if (files.length > 0) {
      setUploadingImage(true)
      files.forEach(file => uploadImageMutation.mutate(file))
      setUploadingImage(false)
    }
    e.currentTarget.value = ''
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      {/* Header */}
      <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory/items')}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">Combo Management</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreateCombo}
            className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            New Combo
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Combos List */}
        <div
          className={cn(
            'w-1/3 border-r flex flex-col',
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
          )}
        >
          {/* Search */}
          <div
            className={cn('px-3 py-2 border-b shrink-0', isDark ? 'border-gray-800' : 'border-gray-100')}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search combos..."
              className={cn(
                'w-full px-2 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                isDark
                  ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                  : 'border-gray-200 bg-white text-gray-900'
              )}
            />
          </div>

          {/* Combos */}
          <div className={cn('flex-1 overflow-y-auto', isDark ? 'divide-gray-800' : 'divide-gray-100')}>
            {isLoading ? (
              <div className={cn('flex items-center justify-center h-20 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Loading…
              </div>
            ) : filteredCombos.length === 0 ? (
              <div className={cn('flex items-center justify-center h-20 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                No combos found
              </div>
            ) : (
              filteredCombos.map((combo) => (
                <div
                  key={combo.id}
                  onClick={() => handleSelectCombo(combo.id)}
                  className={cn(
                    'px-3 py-2 border-b cursor-pointer transition-colors',
                    selectedComboId === combo.id
                      ? isDark
                        ? 'bg-orange-900 border-orange-700'
                        : 'bg-orange-50 border-orange-200'
                      : isDark
                        ? 'hover:bg-gray-800 border-gray-800'
                        : 'hover:bg-gray-50 border-gray-100'
                  )}
                >
                  <p className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {combo.name}
                  </p>
                  <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    ₹{Number(combo.price).toFixed(2)} • {combo.combo_items?.length ?? 0} items
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className={cn('flex-1 flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
          {selectedCombo ? (
            <>
              {/* Combo Header */}
              <div
                className={cn(
                  'px-4 py-3 border-b shrink-0',
                  isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={cn('text-base font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                      {selectedCombo.name}
                    </h2>
                    <p className={cn('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      ₹{Number(selectedCombo.price).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditCombo(selectedCombo)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCombo(selectedCombo.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div
                className={cn(
                  'px-4 border-b flex gap-4 shrink-0',
                  isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                )}
              >
                <button
                  onClick={() => setShowItemSelection(false)}
                  className={cn(
                    'px-2 py-2 text-xs font-semibold border-b-2 transition-colors',
                    !showItemSelection
                      ? 'border-orange-500 text-orange-500'
                      : isDark
                        ? 'border-transparent text-gray-400'
                        : 'border-transparent text-gray-600'
                  )}
                >
                  Images
                </button>
                <button
                  onClick={() => setShowItemSelection(true)}
                  className={cn(
                    'px-2 py-2 text-xs font-semibold border-b-2 transition-colors',
                    showItemSelection
                      ? 'border-orange-500 text-orange-500'
                      : isDark
                        ? 'border-transparent text-gray-400'
                        : 'border-transparent text-gray-600'
                  )}
                >
                  Items
                </button>
              </div>

              {/* Images Tab */}
              {!showItemSelection && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={cn(
                      'border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4 cursor-pointer',
                      isDark
                        ? 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-input"
                    />
                    <label htmlFor="image-input" className="cursor-pointer block">
                      <ImageIcon
                        className={cn('w-8 h-8 mx-auto mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}
                      />
                      <p className={cn('text-sm font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>
                        Drop image here or click to upload
                      </p>
                      <p className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </label>
                  </div>

                  {/* Image Grid */}
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {images.map((image: MediaItem) => (
                        <div key={image.id} className={cn('rounded-lg overflow-hidden relative group', isDark ? 'bg-gray-800' : 'bg-white')}>
                          <img
                            src={image.url}
                            alt={image.entity_type}
                            className="w-full h-32 object-cover"
                          />
                          {image.is_primary && (
                            <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                              Primary
                            </div>
                          )}
                          <button
                            onClick={() => deleteImageMutation.mutate(image.id)}
                            className="absolute bottom-0 left-0 right-0 bg-red-600 hover:bg-red-700 text-white text-xs py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {images.length === 0 && (
                    <div className={cn('text-center py-8', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      <p className="text-sm">No images yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Items Tab */}
              {showItemSelection && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Toolbar */}
                  <div className={cn('px-4 py-2 border-b shrink-0 flex items-center justify-between', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <span className={cn('text-xs font-semibold', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      {localComboItems.length} item{localComboItems.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => { setShowItemPicker((v) => !v); setItemPickerSearch('') }}
                      className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                      Add Item
                    </button>
                  </div>

                  {/* Item Picker */}
                  {showItemPicker && (
                    <div className={cn('shrink-0 border-b', isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100')}>
                      <div className="px-3 py-2 flex items-center gap-2">
                        <Search className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} />
                        <input
                          autoFocus
                          type="text"
                          value={itemPickerSearch}
                          onChange={(e) => setItemPickerSearch(e.target.value)}
                          placeholder="Search items…"
                          className={cn(
                            'flex-1 text-xs bg-transparent focus:outline-none',
                            isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'
                          )}
                        />
                        <button onClick={() => setShowItemPicker(false)}>
                          <X className={cn('w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {items
                          .filter((it) =>
                            it.name.toLowerCase().includes(itemPickerSearch.toLowerCase())
                          )
                          .map((it) => (
                            <button
                              key={it.id}
                              onClick={() => {
                                setLocalComboItems((prev) => [
                                  ...prev,
                                  { item_id: it.id, item_variant_id: null, quantity: 1, sort_order: prev.length },
                                ])
                                setShowItemPicker(false)
                                setItemPickerSearch('')
                              }}
                              className={cn(
                                'w-full text-left px-4 py-2 text-sm transition-colors',
                                isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-white text-gray-800'
                              )}
                            >
                              {it.name}
                            </button>
                          ))}
                        {items.filter((it) => it.name.toLowerCase().includes(itemPickerSearch.toLowerCase())).length === 0 && (
                          <p className={cn('px-4 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No items found</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current Items List */}
                  <div className="flex-1 overflow-y-auto">
                    {localComboItems.length === 0 ? (
                      <div className={cn('flex flex-col items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        <p>No items in this combo</p>
                        <p className="text-xs mt-1">Click "Add Item" to get started</p>
                      </div>
                    ) : (
                      <div className={cn('divide-y', isDark ? 'divide-gray-800' : 'divide-gray-100')}>
                        {localComboItems.map((ci, idx) => {
                          const itemName = items.find((i) => i.id === ci.item_id)?.name ?? ci.item_id
                          return (
                            <div key={idx} className={cn('px-4 py-3 flex items-center gap-3', isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-50')}>
                              <div className="flex-1 min-w-0">
                                <p className={cn('font-semibold text-sm truncate', isDark ? 'text-gray-200' : 'text-gray-800')}>
                                  {itemName}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    setLocalComboItems((prev) =>
                                      prev.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)
                                    )
                                  }
                                  className={cn('w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center', isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={ci.quantity}
                                  onChange={(e) => {
                                    const q = Math.max(1, Number(e.target.value) || 1)
                                    setLocalComboItems((prev) =>
                                      prev.map((x, i) => i === idx ? { ...x, quantity: q } : x)
                                    )
                                  }}
                                  className={cn(
                                    'w-10 text-center text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-orange-400 py-1',
                                    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white text-gray-900'
                                  )}
                                />
                                <button
                                  onClick={() =>
                                    setLocalComboItems((prev) =>
                                      prev.map((x, i) => i === idx ? { ...x, quantity: x.quantity + 1 } : x)
                                    )
                                  }
                                  className={cn('w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center', isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
                                >
                                  +
                                </button>
                              </div>
                              <button
                                onClick={() => setLocalComboItems((prev) => prev.filter((_, i) => i !== idx))}
                                className="shrink-0 text-red-400 hover:text-red-300 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className={cn('px-4 py-3 border-t shrink-0', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <button
                      onClick={() => saveItemsMutation.mutate()}
                      disabled={saveItemsMutation.isPending}
                      className="w-full py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                    >
                      {saveItemsMutation.isPending ? 'Saving…' : 'Save Items'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className={cn(
                'flex items-center justify-center h-full text-sm',
                isDark ? 'text-gray-500' : 'text-gray-400'
              )}
            >
              Select a combo to manage
            </div>
          )}
        </div>
      </div>

      {/* Combo Form Modal */}
      {showComboForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={cn(
              'rounded-lg shadow-xl w-full max-w-md',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {editingCombo ? 'Edit Combo' : 'New Combo'}
              </h3>
              <button
                onClick={() => {
                  setShowComboForm(false)
                  setEditingCombo(null)
                }}
                className={cn('p-1 rounded', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Name
                </label>
                <input
                  type="text"
                  value={comboFormData.name}
                  onChange={(e) => setComboFormData({ ...comboFormData, name: e.target.value })}
                  placeholder="e.g., Burger Combo, Meal Deal"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>

              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description (optional)
                </label>
                <textarea
                  value={comboFormData.description}
                  onChange={(e) => setComboFormData({ ...comboFormData, description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>

              <div>
                <label className={cn('block text-xs font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={comboFormData.price}
                  onChange={(e) => setComboFormData({ ...comboFormData, price: Number(e.target.value) })}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 border',
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-gray-200'
                      : 'border-gray-200 bg-white text-gray-900'
                  )}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={comboFormData.is_active}
                  onChange={(e) => setComboFormData({ ...comboFormData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className={cn('text-xs font-semibold', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Active
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 p-4 border-t" style={{ borderColor: isDark ? '#1f2937' : '#e5e7eb' }}>
              <button
                onClick={() => {
                  setShowComboForm(false)
                  setEditingCombo(null)
                }}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  isDark
                    ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCombo}
                disabled={saveComboMutation.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {saveComboMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
