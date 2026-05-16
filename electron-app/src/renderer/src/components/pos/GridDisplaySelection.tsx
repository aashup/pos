import type React from 'react'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'

export interface GridDisplayItem {
  id: string
  label: string
  sublabel?: string
}

export interface GridDisplaySelectionProps {
  items: GridDisplayItem[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  isMultiSelect?: boolean
  maxSelections?: number
  columns?: number | 'auto'
  accentColor?: 'orange' | 'blue'
  ariaLabel?: string
  renderItem?: (item: GridDisplayItem, isSelected: boolean, isDark: boolean) => React.ReactNode
  className?: string
}

const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

export default function GridDisplaySelection({
  items,
  selectedIds,
  onChange,
  isMultiSelect = false,
  maxSelections,
  columns,
  accentColor = 'blue',
  ariaLabel,
  renderItem,
  className,
}: GridDisplaySelectionProps) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const colsClass =
    columns === 'auto' || columns === undefined
      ? 'grid-cols-2 sm:grid-cols-3'
      : (COLS_CLASS[columns as number] ?? 'grid-cols-2 sm:grid-cols-3')

  const selectedBgClass =
    accentColor === 'orange'
      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
      : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'

  const selectedLabelClass =
    accentColor === 'orange'
      ? 'text-orange-700 dark:text-orange-300'
      : 'text-blue-700 dark:text-blue-300'

  const selectedSublabelClass =
    accentColor === 'orange'
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-blue-600 dark:text-blue-400'

  const unselectedClass = isDark
    ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
    : 'border-gray-200 bg-gray-50 hover:border-gray-300'

  const handleToggle = (id: string) => {
    if (!isMultiSelect) {
      onChange(selectedIds.includes(id) ? [] : [id])
    } else {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((s) => s !== id))
      } else {
        if (maxSelections !== undefined && selectedIds.length >= maxSelections) return
        onChange([...selectedIds, id])
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle(id)
    }
  }

  return (
    <div
      role="listbox"
      aria-multiselectable={isMultiSelect}
      aria-label={ariaLabel}
      className={cn(`grid ${colsClass} gap-2`, className)}
    >
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id)

        if (renderItem) {
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => handleToggle(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              style={{ minHeight: 64, touchAction: 'manipulation' }}
              className={cn(
                'rounded-xl border-2 px-3 py-3 transition-all text-center flex flex-col items-center justify-center cursor-pointer active:scale-95',
                isSelected ? selectedBgClass : unselectedClass,
              )}
            >
              {renderItem(item, isSelected, isDark)}
            </div>
          )
        }

        return (
          <button
            key={item.id}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => handleToggle(item.id)}
            onKeyDown={(e) => handleKeyDown(e, item.id)}
            style={{ minHeight: 64, touchAction: 'manipulation' }}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 transition-all text-center active:scale-95',
              isSelected ? selectedBgClass : unselectedClass,
            )}
          >
            <span
              className={cn(
                'font-semibold text-sm leading-snug',
                isSelected ? selectedLabelClass : '',
              )}
            >
              {item.label}
            </span>
            {item.sublabel !== undefined && (
              <span
                className={cn(
                  'text-sm font-bold mt-1',
                  isSelected ? selectedSublabelClass : 'text-gray-500 dark:text-gray-400',
                )}
              >
                {item.sublabel}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
