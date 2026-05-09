import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Edit2, Trash2, Loader2, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { itemsApi } from '../../api/items'
import { itemVariantsApi } from '../../api/itemVariants'
import { modifierGroupsApi } from '../../api/modifierGroups'
import { mediaApi } from '../../api/media'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { Item, ItemVariant, ModifierGroup, MediaItem } from '../../types'

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const isNew = id === 'new'

  // State
  const [formData, setFormData] = useState<Partial<Item>>({
    name: '',
    sku: '',
    unit: 'PCS',
    selling_price: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    is_active: true,
  })
  const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>([])
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [variantForm, setVariantForm] = useState<Partial<ItemVariant>>({ name: '', sort_order: 0 })
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)

  // Queries
  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      if (isNew) return null
      const res = await itemsApi.get(id!)
      return res.data?.data ?? null
    },
    enabled: !isNew,
  })

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ['variants', id],
    queryFn: async () => {
      if (isNew) return []
      const res = await itemVariantsApi.listByItem(id!)
      return res.data?.data ?? []
    },
    enabled: !isNew && !!id,
  })

  const { data: modifierGroups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: async () => {
      const res = await modifierGroupsApi.list()
      return res.data?.data ?? []
    },
  })

  const { data: media = [] } = useQuery({
    queryKey: ['media', id],
    queryFn: async () => {
      if (isNew) return []
      const res = await mediaApi.getByEntity('item', id!)
      return res.data?.data ?? []
    },
    enabled: !isNew && !!id,
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return await itemsApi.create(formData as any)
      } else {
        return await itemsApi.update(id!, formData)
      }
    },
    onSuccess: (res) => {
      toast.success(isNew ? 'Item created' : 'Item updated')
      if (isNew) navigate(`/inventory/items/${res.data.data.id}`)
      qc.invalidateQueries({ queryKey: ['items'] })
    },
    onError: () => toast.error('Failed to save item'),
  })

  const variantMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      if (editingVariantId) {
        return await itemVariantsApi.update(editingVariantId, variantForm as any)
      } else {
        return await itemVariantsApi.create({ ...variantForm, item_id: id } as any)
      }
    },
    onSuccess: () => {
      toast.success(editingVariantId ? 'Variant updated' : 'Variant created')
      setVariantForm({ name: '', sort_order: 0 })
      setShowVariantForm(false)
      setEditingVariantId(null)
      qc.invalidateQueries({ queryKey: ['variants', id] })
    },
    onError: () => toast.error('Failed to save variant'),
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => itemVariantsApi.delete(variantId),
    onSuccess: () => {
      toast.success('Variant deleted')
      qc.invalidateQueries({ queryKey: ['variants', id] })
    },
    onError: () => toast.error('Failed to delete variant'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!id) return
      return await mediaApi.upload(file, 'item', id)
    },
    onSuccess: () => {
      toast.success('Image uploaded')
      qc.invalidateQueries({ queryKey: ['media', id] })
    },
    onError: () => toast.error('Failed to upload image'),
  })

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => mediaApi.delete(mediaId),
    onSuccess: () => {
      toast.success('Image deleted')
      qc.invalidateQueries({ queryKey: ['media', id] })
    },
    onError: () => toast.error('Failed to delete image'),
  })

  // Initialize form
  useEffect(() => {
    if (item) {
      setFormData(item)
      setSelectedModifierGroups(item.modifier_groups?.map(g => g.id) ?? [])
    }
  }, [item])

  // Handle variant edit
  const handleEditVariant = (variant: ItemVariant) => {
    setVariantForm(variant)
    setEditingVariantId(variant.id)
    setShowVariantForm(true)
  }

  if (itemLoading) {
    return (
      <div className={cn('h-screen flex items-center justify-center', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-500' : 'text-gray-400')} />
      </div>
    )
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <header className={cn('h-12 flex items-center justify-between px-4 shrink-0', isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border-b border-gray-200')}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/inventory/items')} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">{isNew ? 'New Item' : formData.name || 'Edit Item'}</span>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Item Form */}
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Item Details</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              />
            </div>
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>SKU</label>
              <input
                type="text"
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              />
            </div>
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Unit *</label>
              <select
                value={formData.unit || 'PCS'}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              >
                <option>PCS</option>
                <option>KG</option>
                <option>L</option>
                <option>BOX</option>
                <option>STRIP</option>
              </select>
            </div>
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Selling Price</label>
              <input
                type="number"
                value={formData.selling_price || 0}
                onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              />
            </div>
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>CGST %</label>
              <input
                type="number"
                value={formData.cgst || 0}
                onChange={(e) => setFormData({ ...formData, cgst: Number(e.target.value) })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              />
            </div>
            <div>
              <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>SGST %</label>
              <input
                type="number"
                value={formData.sgst || 0}
                onChange={(e) => setFormData({ ...formData, sgst: Number(e.target.value) })}
                className={cn('w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active ?? true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="is_active" className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Active</label>
          </div>
        </div>

        {/* Variants Section */}
        {!isNew && (
          <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
            <div className="flex items-center justify-between">
              <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Variants</h3>
              <button
                onClick={() => {
                  setVariantForm({ name: '', sort_order: 0 })
                  setEditingVariantId(null)
                  setShowVariantForm(true)
                }}
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {showVariantForm && (
              <div className={cn('p-3 rounded-lg space-y-2 border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <input
                  type="text"
                  placeholder="Variant name (e.g., Small, Large)"
                  value={variantForm.name || ''}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  className={cn('w-full px-3 py-2 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-300 bg-white')}
                />
                <input
                  type="number"
                  placeholder="Price override (optional)"
                  value={variantForm.price_override || ''}
                  onChange={(e) => setVariantForm({ ...variantForm, price_override: e.target.value ? Number(e.target.value) : undefined })}
                  className={cn('w-full px-3 py-2 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'border-gray-300 bg-white')}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => variantMutation.mutate()}
                    disabled={variantMutation.isPending}
                    className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium disabled:opacity-50"
                  >
                    {variantMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                    {editingVariantId ? 'Update' : 'Add'}
                  </button>
                  <button
                    onClick={() => {
                      setShowVariantForm(false)
                      setEditingVariantId(null)
                    }}
                    className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {variantsLoading ? (
              <div className={cn('text-xs text-center py-2', isDark ? 'text-gray-400' : 'text-gray-500')}>Loading...</div>
            ) : variants.length === 0 ? (
              <div className={cn('text-xs text-center py-2', isDark ? 'text-gray-400' : 'text-gray-500')}>No variants yet</div>
            ) : (
              <div className="space-y-1">
                {variants.map((v) => (
                  <div key={v.id} className={cn('flex items-center justify-between p-2 rounded text-sm', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <div>
                      <p className={isDark ? 'text-gray-200' : 'text-gray-800'}>{v.name}</p>
                      {v.price_override && <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>₹{v.price_override}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditVariant(v)} className="p-1 text-gray-400 hover:text-white">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => deleteVariantMutation.mutate(v.id)} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modifier Groups Section */}
        {!isNew && (
          <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Modifier Groups</h3>
            <div className="space-y-2">
              {modifierGroups.length === 0 ? (
                <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>No modifier groups available</p>
              ) : (
                modifierGroups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModifierGroups.includes(g.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModifierGroups([...selectedModifierGroups, g.id])
                        } else {
                          setSelectedModifierGroups(selectedModifierGroups.filter(id => id !== g.id))
                        }
                      }}
                      className="rounded"
                    />
                    <span className={cn('text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>{g.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {/* Media Section */}
        {!isNew && (
          <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Images</h3>

            <label className={cn('flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors', isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50')}>
              <div className="text-center">
                <Upload className={cn('w-5 h-5 mx-auto mb-1', isDark ? 'text-gray-400' : 'text-gray-600')} />
                <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>Click or drag image</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                }}
                className="hidden"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {media.map((m) => (
                <div key={m.id} className={cn('relative rounded-lg overflow-hidden', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <img src={m.url} alt="Item" className="w-full h-24 object-cover" />
                  <button
                    onClick={() => deleteMediaMutation.mutate(m.id)}
                    className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
