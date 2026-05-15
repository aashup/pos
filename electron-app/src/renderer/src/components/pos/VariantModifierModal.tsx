import { useState } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ipc, type POSItemVariant, type POSModifierGroup } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import type { SelectedModifier } from '../../types'
import type { POSItem } from './ItemGrid'

interface Props {
  item: POSItem
  onConfirm: (variant: POSItemVariant | null, modifiers: SelectedModifier[]) => void
  onClose: () => void
}

export default function VariantModifierModal({ item, onConfirm, onClose }: Props) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  // Map of modifier_group_id → Set of selected modifier ids
  const [selectedByGroup, setSelectedByGroup] = useState<Map<string, Set<string>>>(new Map())

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
    const count = selectedByGroup.get(g.id)?.size ?? 0
    return count >= (g.min_selections || 1)
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

  const toggleModifier = (group: POSModifierGroup, modifierId: string) => {
    setSelectedByGroup((prev) => {
      const next = new Map(prev)
      const current = new Set(next.get(group.id) ?? [])
      if (current.has(modifierId)) {
        current.delete(modifierId)
      } else {
        if (group.max_selections === 1) {
          current.clear()
        } else if (current.size >= group.max_selections) {
          return prev
        }
        current.add(modifierId)
      }
      next.set(group.id, current)
      return next
    })
  }

  const handleConfirm = () => {
    if (!canAdd) return
    const mods: SelectedModifier[] = []
    modifierGroups.forEach((g) => {
      const sel = selectedByGroup.get(g.id) ?? new Set<string>()
      ;(g.modifiers ?? []).forEach((m) => {
        if (sel.has(m.id)) {
          mods.push({ modifier_id: m.id, modifier_name: m.name, price: m.price })
        }
      })
    })
    onConfirm(selectedVariant, mods)
  }

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
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {/* Variants section */}
              {variants.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-base">Choose Variant</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
                      Required
                    </span>
                    {selectedVariantId && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {variants.map((v) => {
                      const price = v.price_override ?? item.selling_price ?? 0
                      const isSelected = selectedVariantId === v.id
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariantId(v.id)}
                          style={{ minHeight: 64 }}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 transition-all text-center',
                            isSelected
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                              : isDark
                                ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                          )}
                        >
                          <span className={cn(
                            'font-semibold text-sm leading-snug',
                            isSelected ? 'text-orange-700 dark:text-orange-300' : '',
                          )}>
                            {v.name}
                          </span>
                          <span className={cn(
                            'text-sm font-bold mt-1',
                            isSelected ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400',
                          )}>
                            ₹{price.toFixed(0)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Modifier group sections */}
              {modifierGroups.map((group) => {
                const sel = selectedByGroup.get(group.id) ?? new Set<string>()
                const selCount = sel.size
                const groupSatisfied = !group.is_required || selCount >= (group.min_selections || 1)

                return (
                  <section key={group.id}>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="font-semibold text-base">{group.name}</span>
                      {group.is_required ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
                          Required
                        </span>
                      ) : (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500',
                        )}>
                          Optional
                        </span>
                      )}
                      {group.max_selections > 1 && (
                        <span className={cn(
                          'text-xs',
                          isDark ? 'text-gray-500' : 'text-gray-400',
                        )}>
                          Pick up to {group.max_selections}
                        </span>
                      )}
                      {groupSatisfied && selCount > 0 && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(group.modifiers ?? []).map((mod) => {
                        const isSelected = sel.has(mod.id)
                        return (
                          <button
                            key={mod.id}
                            onClick={() => toggleModifier(group, mod.id)}
                            style={{ minHeight: 64 }}
                            className={cn(
                              'flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 transition-all text-center',
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : isDark
                                  ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                            )}
                          >
                            <span className={cn(
                              'font-semibold text-sm leading-snug',
                              isSelected ? 'text-blue-700 dark:text-blue-300' : '',
                            )}>
                              {mod.name}
                            </span>
                            {mod.price > 0 && (
                              <span className={cn(
                                'text-sm font-bold mt-1',
                                isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400',
                              )}>
                                +₹{mod.price.toFixed(0)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </section>
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
          {/* Price preview */}
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

          {/* Validation hint */}
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
