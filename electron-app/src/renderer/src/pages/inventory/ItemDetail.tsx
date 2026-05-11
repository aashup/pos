import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Loader2, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { itemsApi } from '../../api/items'
import { itemVariantsApi } from '../../api/itemVariants'
import { modifierGroupsApi } from '../../api/modifierGroups'
import { mediaApi } from '../../api/media'
import { unitsApi, type Unit } from '../../api/units'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { Item, ModifierGroup, MediaItem } from '../../types'

type VariantRow = { id?: string; name: string; price: string }

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const isNew = id === 'new'

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<Partial<Item>>({
    name: '',
    unit: '',
    selling_price: 0,
    cgst: 2.5,
    sgst: 2.5,
    igst: 0,
    is_active: true,
  })
  const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>([])
  const [variantRows, setVariantRows] = useState<VariantRow[]>([])

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      if (isNew) return null
      const res = await itemsApi.get(id!)
      return res.data?.data ?? null
    },
    enabled: !isNew,
  })

  const { data: serverVariants = [], isLoading: variantsLoading } = useQuery({
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

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await unitsApi.list()
      return res.data?.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  // ── Mutations ───────────────────────────────────────────────────────────────
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

  // Bulk save: create new rows, update existing, delete removed — all in parallel
  const saveVariantsMutation = useMutation({
    mutationFn: async () => {
      if (!id || isNew) return

      const ops: Promise<unknown>[] = []

      // Rows with no id → create
      for (const row of variantRows) {
        if (!row.id && row.name.trim()) {
          ops.push(
            itemVariantsApi.create({
              item_id: id,
              name: row.name.trim(),
              price_override: row.price ? Number(row.price) : undefined,
              sort_order: variantRows.indexOf(row),
            } as any),
          )
        }
      }

      // Rows with id → update
      for (const row of variantRows) {
        if (row.id && row.name.trim()) {
          ops.push(
            itemVariantsApi.update(row.id, {
              name: row.name.trim(),
              price_override: row.price ? Number(row.price) : undefined,
              sort_order: variantRows.indexOf(row),
            } as any),
          )
        }
      }

      // Server variants whose id is no longer in variantRows → delete
      const activeIds = new Set(variantRows.map((r) => r.id).filter(Boolean))
      for (const sv of serverVariants) {
        if (!activeIds.has(sv.id)) {
          ops.push(itemVariantsApi.delete(sv.id))
        }
      }

      await Promise.all(ops)
    },
    onSuccess: () => {
      toast.success('Variants saved')
      qc.invalidateQueries({ queryKey: ['variants', id] })
    },
    onError: () => toast.error('Failed to save variants'),
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

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (item) {
      setFormData(item)
      setSelectedModifierGroups(item.modifier_groups?.map((g: any) => g.id) ?? [])
    }
  }, [item])

  useEffect(() => {
    setVariantRows(
      serverVariants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price_override != null ? String(v.price_override) : '',
      })),
    )
  }, [serverVariants])

  // ── Variant row helpers ──────────────────────────────────────────────────────
  const addVariantRow = () =>
    setVariantRows((rows) => [...rows, { name: '', price: '' }])

  const updateVariantRow = (idx: number, field: keyof VariantRow, value: string) =>
    setVariantRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))

  const removeVariantRow = (idx: number) =>
    setVariantRows((rows) => rows.filter((_, i) => i !== idx))

  // ── Render ───────────────────────────────────────────────────────────────────
  if (itemLoading) {
    return (
      <div className={cn('h-screen flex items-center justify-center', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
        <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-gray-500' : 'text-gray-400')} />
      </div>
    )
  }

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white',
  )
  const labelCls = cn('block text-xs font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')

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

        {/* ── Item Details ── */}
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Item Details</h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Name — full width */}
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Unit *</label>
              <select
                value={formData.unit || ''}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={inputCls}
              >
                <option value="">— Select unit —</option>
                {units.length > 0
                  ? units.map((u) => (
                      <option key={u.id} value={u.value}>
                        {u.value} — {u.label}
                      </option>
                    ))
                  : ['PCS', 'KG', 'L', 'BOX', 'STRIP'].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Selling Price</label>
              <input
                type="number"
                value={formData.selling_price || 0}
                onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>CGST %</label>
              <input
                type="number"
                value={formData.cgst ?? 2.5}
                onChange={(e) => setFormData({ ...formData, cgst: Number(e.target.value) })}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>SGST %</label>
              <input
                type="number"
                value={formData.sgst ?? 2.5}
                onChange={(e) => setFormData({ ...formData, sgst: Number(e.target.value) })}
                className={inputCls}
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

        {/* ── Variants ── (only after item is saved) */}
        {!isNew && (
          <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Variants</h3>

            {variantsLoading ? (
              <div className={cn('text-xs text-center py-2', isDark ? 'text-gray-400' : 'text-gray-500')}>Loading…</div>
            ) : (
              <>
                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      <th className="text-left pb-2 pr-2">Variant Name</th>
                      <th className="text-left pb-2 pr-2">Price (₹)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {variantRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className={cn('text-xs text-center py-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          No variants yet — click + Add Row
                        </td>
                      </tr>
                    ) : (
                      variantRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="pr-2 pb-1.5">
                            <input
                              type="text"
                              placeholder="e.g. Small"
                              value={row.name}
                              onChange={(e) => updateVariantRow(idx, 'name', e.target.value)}
                              className={cn(
                                'w-full px-2 py-1.5 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400',
                                isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white',
                              )}
                            />
                          </td>
                          <td className="pr-2 pb-1.5">
                            <input
                              type="number"
                              placeholder="0"
                              value={row.price}
                              onChange={(e) => updateVariantRow(idx, 'price', e.target.value)}
                              className={cn(
                                'w-full px-2 py-1.5 rounded text-sm border focus:outline-none focus:ring-2 focus:ring-orange-400',
                                isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white',
                              )}
                            />
                          </td>
                          <td className="pb-1.5">
                            <button
                              onClick={() => removeVariantRow(idx)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={addVariantRow}
                    className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                  <button
                    onClick={() => saveVariantsMutation.mutate()}
                    disabled={saveVariantsMutation.isPending}
                    className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {saveVariantsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Variants
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Modifier Groups ── */}
        {!isNew && (
          <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Modifier Groups</h3>
            <div className="space-y-2">
              {modifierGroups.length === 0 ? (
                <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>No modifier groups available</p>
              ) : (
                modifierGroups.map((g: any) => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModifierGroups.includes(g.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModifierGroups([...selectedModifierGroups, g.id])
                        } else {
                          setSelectedModifierGroups(selectedModifierGroups.filter((mid) => mid !== g.id))
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

        {/* ── Images ── */}
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
              {(media as MediaItem[]).map((m) => (
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
