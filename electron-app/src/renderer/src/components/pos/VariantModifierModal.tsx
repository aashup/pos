import { useState } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ipc, type POSItemVariant, type POSModifierGroup } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { SelectedModifier } from '../../types'
import type { POSItem } from './ItemGrid'
import GridDisplaySelection from './GridDisplaySelection'

interface Props {
  item: POSItem
  onConfirm: (variant: POSItemVariant | null, modifiers: SelectedModifier[]) => void
  onClose: () => void
}

export default function VariantModifierModal({ item, onConfirm, onClose }: Props) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  // Map of modifier_group_id → Set of selected modifier ids (for groups WITH sub-modifiers)
  const [selectedByGroup, setSelectedByGroup] = useState<Map<string, Set<string>>>(new Map())
  // Flat selections: groups with no sub-modifiers are toggled as a whole
  const [selectedFlatIds, setSelectedFlatIds] = useState<string[]>([])

  const { data: variants = [], isLoading: loadingVariants } = useQuery<POSItemVariant[]>({
    queryKey: ['item-variants', item.id],
    queryFn: () => ipc.items.getVariants(item.id),
    staleTime: 60_000,
  })

  const { data: modifierGroups = [], isLoading: loadingGroups } = useQuery<POSModifierGroup[]>({
    queryKey: ['item-modifier-groups', item.id],
    queryFn: () => ipc.items.getModifierGroups(item.id),
    staleTime: 60_000,
  })

  const isLoading = loadingVariants || loadingGroups

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null

  const variantRequired = variants.length > 0
  const variantSatisfied = !variantRequired || selectedVariantId !== null

  const requiredGroupsMet = modifierGroups.every((g) => {
    if (!g.is_required) return true
    if ((g.modifiers ?? []).length > 0) {
      const count = selectedByGroup.get(g.id)?.size ?? 0
      return count >= (g.min_selections || 1)
    }
    return selectedFlatIds.includes(g.id)
  })

  const canAdd = !isLoading && variantSatisfied && requiredGroupsMet

  const basePrice = selectedVariant?.price_override ?? item.selling_price ?? 0
  const modifiersTotal = modifierGroups.reduce((sum, g) => {
    const sel = selectedByGroup.get(g.id) ?? new Set<string>()
    return sum + (g.modifiers ?? [])
      .filter((m) => sel.has(m.id))
      .reduce((s, m) => s + m.price, 0)
  }, 0)
  const totalPrice = basePrice + modifiersTotal

  const toggleFlatGroup = (groupId: string) => {
    setSelectedFlatIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  const handleConfirm = () => {
    if (!canAdd) return
    const mods: SelectedModifier[] = []

    modifierGroups.forEach((g) => {
      if ((g.modifiers ?? []).length === 0) {
        // Flat group — the group itself is the modifier
        if (selectedFlatIds.includes(g.id)) {
          mods.push({ modifier_id: g.id, modifier_name: g.name, price: 0 })
        }
      } else {
        const sel = selectedByGroup.get(g.id) ?? new Set<string>()
        ;(g.modifiers ?? []).forEach((m) => {
          if (sel.has(m.id)) {
            mods.push({ modifier_id: m.id, modifier_name: m.name, price: m.price })
          }
        })
      }
    })

    onConfirm(selectedVariant, mods)
  }

  // ── Shared badge helpers ────────────────────────────────────────────────────

  const requiredBadge = (
    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
      Required
    </span>
  )

  const optionalBadge = (
    <span className={cn(
      'text-xs px-1.5 py-0.5 rounded-full font-medium',
      isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500',
    )}>
      Optional
    </span>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'w-full max-w-lg mx-4 max-h-[90vh] flex flex-col rounded-2xl shadow-2xl',
          isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'flex items-start justify-between p-5 border-b shrink-0',
          isDark ? 'border-gray-800' : 'border-gray-200',
        )}>
          <div>
            <h2 className="text-lg font-bold leading-tight">{item.name}</h2>
            <p className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Base ₹{(item.selling_price ?? 0).toFixed(0)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ minHeight: 44, minWidth: 44 }}
            className={cn(
              'flex items-center justify-center rounded-xl transition-colors',
              isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {/* ── Variants ── */}
              {variants.length > 0 && (
                <div className={cn(
                  'rounded-xl border overflow-hidden',
                  isDark ? 'border-gray-700' : 'border-gray-200',
                )}>
                  {/* Group label strip */}
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 border-b',
                    isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50',
                  )}>
                    <span className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      Variant
                    </span>
                    {requiredBadge}
                    {selectedVariantId && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                  </div>
                  <div className="p-3">
                    <GridDisplaySelection
                      items={variants.map((v) => ({
                        id: v.id,
                        label: v.name,
                        sublabel: `₹${(v.price_override ?? item.selling_price ?? 0).toFixed(0)}`,
                      }))}
                      selectedIds={selectedVariantId ? [selectedVariantId] : []}
                      onChange={(ids) => setSelectedVariantId(ids[0] as string ?? null)}
                      isMultiSelect={false}
                      accentColor="orange"
                    />
                  </div>
                </div>
              )}

              {/* ── Modifier groups ── */}
              {modifierGroups.map((group) => {
                const hasMods = (group.modifiers ?? []).length > 0

                // ── Flat group: no sub-modifiers — card itself is the toggle ──
                if (!hasMods) {
                  const isSelected = selectedFlatIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleFlatGroup(group.id)}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        'w-full text-left rounded-xl border-2 overflow-hidden transition-all active:scale-[0.99]',
                        isSelected
                          ? 'border-orange-500'
                          : isDark ? 'border-gray-700' : 'border-gray-200',
                      )}
                    >
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2.5',
                        isSelected
                          ? isDark ? 'bg-orange-900/25' : 'bg-orange-50'
                          : isDark ? 'bg-gray-800/60' : 'bg-gray-50',
                      )}>
                        <span className={cn(
                          'text-xs font-semibold uppercase tracking-wider',
                          isSelected
                            ? 'text-orange-600 dark:text-orange-400'
                            : isDark ? 'text-gray-400' : 'text-gray-500',
                        )}>
                          {group.name}
                        </span>
                        {group.is_required ? requiredBadge : optionalBadge}
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                      </div>
                    </button>
                  )
                }

                // ── Nested group: card with modifier grid inside ──
                const sel = selectedByGroup.get(group.id) ?? new Set<string>()
                const selCount = sel.size
                const groupSatisfied = !group.is_required || selCount >= (group.min_selections || 1)

                return (
                  <div
                    key={group.id}
                    className={cn(
                      'rounded-xl border overflow-hidden',
                      isDark ? 'border-gray-700' : 'border-gray-200',
                    )}
                  >
                    {/* Group label strip */}
                    <div className={cn(
                      'flex items-center gap-2 px-3 py-2 border-b',
                      isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50',
                    )}>
                      <span className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {group.name}
                      </span>
                      {group.is_required ? requiredBadge : optionalBadge}
                      {group.max_selections > 1 && (
                        <span className={cn('text-xs ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          · up to {group.max_selections}
                        </span>
                      )}
                      {groupSatisfied && selCount > 0 && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                      )}
                    </div>

                    {/* Modifier grid */}
                    <div className={cn('p-3', isDark ? 'bg-gray-900' : 'bg-white')}>
                      <GridDisplaySelection
                        items={(group.modifiers ?? []).map((m) => ({
                          id: m.id,
                          label: m.name,
                          sublabel: m.price > 0 ? `+₹${m.price.toFixed(0)}` : undefined,
                        }))}
                        selectedIds={Array.from(sel)}
                        onChange={(ids) => {
                          setSelectedByGroup((prev) => {
                            const next = new Map(prev)
                            next.set(group.id, new Set(ids as string[]))
                            return next
                          })
                        }}
                        isMultiSelect={group.max_selections > 1}
                        maxSelections={group.max_selections > 1 ? group.max_selections : undefined}
                        accentColor="blue"
                      />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'p-5 border-t shrink-0',
          isDark ? 'border-gray-800' : 'border-gray-200',
        )}>
          <div className="flex items-baseline justify-between mb-4">
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Total
              {modifiersTotal > 0 && (
                <span className="ml-1 text-xs">
                  (₹{basePrice.toFixed(0)} + ₹{modifiersTotal.toFixed(0)} add-ons)
                </span>
              )}
            </span>
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ₹{totalPrice.toFixed(0)}
            </span>
          </div>

          {!variantSatisfied && (
            <p className="text-xs text-red-500 mb-2">Please select a variant to continue</p>
          )}
          {variantSatisfied && !requiredGroupsMet && (
            <p className="text-xs text-red-500 mb-2">Please complete all required selections</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!canAdd}
            style={{ minHeight: 56 }}
            className={cn(
              'w-full rounded-xl font-bold text-base transition-all',
              canAdd
                ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
