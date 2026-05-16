import type React from 'react'
import { useRef } from 'react'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Theme configuration
// ---------------------------------------------------------------------------

/**
 * Full theme configuration for GridDisplaySelection.
 * All fields are optional — provide only what you want to override.
 * When omitted entirely, the component falls back to the global Tailwind
 * dark-mode path (backward-compatible with all existing consumers).
 *
 * @example — Example A: Light mode, standard sizing (no themeConfig needed)
 * ```tsx
 * <GridDisplaySelection
 *   items={[{ id: 'sm', label: 'Small', sublabel: '₹120' }]}
 *   selectedIds={[selected]}
 *   onChange={(ids) => setSelected(ids[0] as string)}
 *   columns={3}
 *   accentColor="blue"
 * />
 * ```
 *
 * @example — Example B: Dark mode, 1.5× zoom, high-contrast kiosk layout
 * ```tsx
 * <GridDisplaySelection
 *   items={[
 *     { id: 'sm', label: 'Small', sublabel: '₹120', description: '250ml' },
 *     { id: 'md', label: 'Medium', sublabel: '₹180', description: '500ml' },
 *     { id: 'lg', label: 'Large', sublabel: '₹240', description: '750ml', disabled: true },
 *   ]}
 *   selectedIds={selected ? [selected] : []}
 *   onChange={(ids) => setSelected((ids[0] as string) ?? null)}
 *   isMultiSelect={false}
 *   columns={2}
 *   ariaLabel="Select drink size"
 *   themeConfig={{
 *     background:     '#0f172a',              // slate-900
 *     surface:        '#1e293b',              // slate-800
 *     border:         '#334155',              // slate-700
 *     textPrimary:    '#f1f5f9',              // slate-100
 *     textSecondary:  '#94a3b8',              // slate-400
 *     primary:        '#f97316',              // orange-500
 *     selectedBg:     'rgba(249,115,22,0.15)',
 *     selectedBorder: '#f97316',
 *     selectedText:   '#fdba74',              // orange-300
 *     fontFamily:     'Inter, sans-serif',
 *     fontSizeBase:   14,                     // px — scaled by zoomFactor
 *     fontWeight:     600,
 *     zoomFactor:     1.5,
 *     // Results: gap=12px, padding=18px, fontSize=21px, minHeight=96px
 *   }}
 * />
 * ```
 */
export interface GridThemeConfig {
  /** Outer container background */
  background?: string
  /** Unselected item card background */
  surface?: string
  /** Unselected item card border color */
  border?: string
  /** Primary label color on unselected items */
  textPrimary?: string
  /** Sublabel / description color on unselected items */
  textSecondary?: string
  /** Accent color — used as selectedBorder and selectedText fallback */
  primary?: string
  /** Selected item card background fill */
  selectedBg?: string
  /** Selected item card border color (falls back to primary) */
  selectedBorder?: string
  /** Selected item label color (falls back to primary) */
  selectedText?: string
  /** Font family string, e.g. 'Inter, sans-serif' */
  fontFamily?: string
  /** Base font size in px before zoom scaling (default: 14) */
  fontSizeBase?: number
  /** Font weight for item labels (default: 600) */
  fontWeight?: number | string
  /**
   * UI zoom multiplier (default: 1.0).
   * Scales gap, padding, font-size, and min-height proportionally.
   * Min-height floor is always 56 px (project touch-target rule).
   */
  zoomFactor?: number
}

// ---------------------------------------------------------------------------
// Item & props interfaces
// ---------------------------------------------------------------------------

export interface GridDisplayItem {
  id: string | number
  label: string
  /** Secondary value shown below label (e.g. price) */
  sublabel?: string
  /** Optional icon node rendered above the label */
  icon?: React.ReactNode
  /** Tertiary descriptor shown below sublabel in smaller text */
  description?: string
  /** When true: non-interactive, aria-disabled, reduced opacity */
  disabled?: boolean
}

export interface GridDisplaySelectionProps {
  items: GridDisplayItem[]
  /** Controlled selected IDs — supports string or number values */
  selectedIds: (string | number)[]
  onChange: (selectedIds: (string | number)[]) => void
  /** false → radio group (single select), true → checkbox group */
  isMultiSelect?: boolean
  /** Cap on selections; only relevant when isMultiSelect=true */
  maxSelections?: number
  /** Number of grid columns or 'auto' for responsive 2→3 */
  columns?: number | 'auto'
  /** Accent preset — only used when themeConfig is absent */
  accentColor?: 'orange' | 'blue'
  /** ARIA label for the listbox container */
  ariaLabel?: string
  /** Custom render slot — receives (item, isSelected, isDark) */
  renderItem?: (item: GridDisplayItem, isSelected: boolean, isDark: boolean) => React.ReactNode
  className?: string
  /** When provided, activates the CSS Custom Property theming branch */
  themeConfig?: GridThemeConfig
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/** Monotonic counter — gives each mounted instance a unique scope class */
let _gdsCounter = 0

/** Normalize id to string for safe === comparison regardless of input type */
const idStr = (id: string | number): string => String(id)

/**
 * Maps a GridThemeConfig to a flat CSS Custom Property record.
 * All scaled values (gap, padding, font-size, min-height) are derived from
 * zoomFactor so the entire UI scales proportionally with one knob.
 */
function buildCssVars(config: GridThemeConfig): Record<string, string> {
  const zoom = config.zoomFactor ?? 1.0
  const vars: Record<string, string> = {}

  if (config.background)         vars['--gds-background']      = config.background
  if (config.surface)            vars['--gds-surface']         = config.surface
  if (config.border)             vars['--gds-border']          = config.border
  if (config.textPrimary)        vars['--gds-text-primary']    = config.textPrimary
  if (config.textSecondary)      vars['--gds-text-secondary']  = config.textSecondary
  if (config.primary)            vars['--gds-primary']         = config.primary
  if (config.selectedBg)         vars['--gds-selected-bg']     = config.selectedBg
  if (config.selectedBorder)     vars['--gds-selected-border'] = config.selectedBorder
  if (config.selectedText)       vars['--gds-selected-text']   = config.selectedText
  if (config.fontFamily)         vars['--gds-font-family']     = config.fontFamily
  if (config.fontWeight != null) vars['--gds-font-weight']     = String(config.fontWeight)

  const baseFs = config.fontSizeBase ?? 14
  vars['--gds-font-size']  = `${Math.max(10, Math.round(baseFs * zoom * 10) / 10)}px`
  vars['--gds-gap']        = `${Math.round(8 * zoom)}px`
  vars['--gds-px']         = `${Math.round(12 * zoom)}px`
  vars['--gds-py']         = `${Math.round(12 * zoom)}px`
  // 56px floor: CLAUDE.md hard rule for all touch targets in this project
  vars['--gds-min-height'] = `${Math.max(56, Math.round(64 * zoom))}px`

  return vars
}

// ---------------------------------------------------------------------------
// Tailwind column class map (static — dynamic interpolation is purged in v4)
// ---------------------------------------------------------------------------

const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  themeConfig,
}: GridDisplaySelectionProps) {
  // Stable scope ID — unique per mounted instance, never changes on re-render
  const scopeIdRef = useRef<string | null>(null)
  if (scopeIdRef.current === null) {
    scopeIdRef.current = `gds-scope-${_gdsCounter++}`
  }
  const scopeId = scopeIdRef.current

  // Theme store — always called (hook rule); only used in the Tailwind branch
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  // String-normalize all selected IDs once to avoid repeated coercion
  const normalizedSelectedIds = selectedIds.map(idStr)

  // Column grid class
  const colsClass =
    columns === 'auto' || columns === undefined
      ? 'grid-cols-2 sm:grid-cols-3'
      : (COLS_CLASS[columns as number] ?? 'grid-cols-2 sm:grid-cols-3')

  // ---------------------------------------------------------------------------
  // Tailwind-branch accent classes (only used when themeConfig is absent)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggle = (id: string | number) => {
    const key = idStr(id)
    if (!isMultiSelect) {
      // Radio: deselect if already selected, else select
      onChange(normalizedSelectedIds.includes(key) ? [] : [id])
    } else {
      if (normalizedSelectedIds.includes(key)) {
        onChange(selectedIds.filter((s) => idStr(s) !== key))
      } else {
        if (maxSelections !== undefined && selectedIds.length >= maxSelections) return
        onChange([...selectedIds, id])
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string | number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle(id)
    }
  }

  // ---------------------------------------------------------------------------
  // CSS-var branch: container style + scoped <style> tag
  // ---------------------------------------------------------------------------

  const containerStyle: React.CSSProperties | undefined = themeConfig
    ? ({
        ...buildCssVars(themeConfig),
        gap: 'var(--gds-gap)',
        ...(themeConfig.background ? { backgroundColor: 'var(--gds-background)' } : {}),
      } as React.CSSProperties)
    : undefined

  const scopedStyles = themeConfig
    ? `
      .${scopeId} .gds-item:active:not([aria-disabled="true"]) {
        transform: scale(0.97);
        transition: transform 80ms ease;
      }
      .${scopeId} .gds-item[aria-disabled="true"] {
        opacity: 0.4;
        pointer-events: none;
        cursor: not-allowed;
      }
    `
    : null

  // ---------------------------------------------------------------------------
  // Inline style builders for CSS-var branch items
  // ---------------------------------------------------------------------------

  const getThemedCardStyle = (isSelected: boolean): React.CSSProperties => ({
    minHeight: 'var(--gds-min-height)',
    touchAction: 'manipulation',
    padding: 'var(--gds-py) var(--gds-px)',
    backgroundColor: isSelected
      ? 'var(--gds-selected-bg, var(--gds-surface, transparent))'
      : 'var(--gds-surface, transparent)',
    border: `2px solid ${isSelected ? 'var(--gds-selected-border, var(--gds-primary, currentColor))' : 'var(--gds-border, currentColor)'}`,
    color: isSelected
      ? 'var(--gds-selected-text, var(--gds-primary, currentColor))'
      : 'var(--gds-text-primary, currentColor)',
    fontFamily: 'var(--gds-font-family, inherit)',
    fontSize: 'var(--gds-font-size, 0.875rem)',
    fontWeight: 'var(--gds-font-weight, 600)',
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease',
  })

  const getThemedTextStyle = (isSelected: boolean, secondary = false): React.CSSProperties => ({
    color: isSelected
      ? 'var(--gds-selected-text, var(--gds-primary, currentColor))'
      : secondary
        ? 'var(--gds-text-secondary, currentColor)'
        : 'inherit',
  })

  const themedDescStyle: React.CSSProperties = {
    color: 'var(--gds-text-secondary, currentColor)',
    fontSize: 'calc(var(--gds-font-size, 0.875rem) * 0.82)',
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role="listbox"
      aria-multiselectable={isMultiSelect}
      aria-label={ariaLabel}
      className={cn(
        `grid ${colsClass}`,
        themeConfig ? scopeId : 'gap-2',
        className,
      )}
      style={containerStyle}
    >
      {/* Scoped active/disabled styles — only injected in CSS-var branch */}
      {scopedStyles && <style>{scopedStyles}</style>}

      {items.map((item) => {
        const isSelected = normalizedSelectedIds.includes(idStr(item.id))
        const isDisabled = item.disabled === true
        const key = idStr(item.id)

        // ------------------------------------------------------------------
        // Custom render slot
        // ------------------------------------------------------------------
        if (renderItem) {
          return (
            <div
              key={key}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isDisabled || undefined}
              tabIndex={isDisabled ? -1 : 0}
              onClick={isDisabled ? undefined : () => handleToggle(item.id)}
              onKeyDown={isDisabled ? undefined : (e) => handleKeyDown(e, item.id)}
              className={cn(
                'gds-item rounded-xl border-2 px-3 py-3 text-center flex flex-col items-center justify-center cursor-pointer',
                themeConfig
                  ? undefined
                  : cn(
                      'transition-all active:scale-95',
                      isSelected ? selectedBgClass : unselectedClass,
                      isDisabled && 'opacity-40 pointer-events-none',
                    ),
              )}
              style={
                themeConfig
                  ? getThemedCardStyle(isSelected)
                  : { minHeight: 64, touchAction: 'manipulation' }
              }
            >
              {renderItem(item, isSelected, isDark)}
            </div>
          )
        }

        // ------------------------------------------------------------------
        // Default button rendering
        // ------------------------------------------------------------------
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            onClick={isDisabled ? undefined : () => handleToggle(item.id)}
            onKeyDown={isDisabled ? undefined : (e) => handleKeyDown(e, item.id)}
            className={cn(
              'gds-item flex flex-col items-center justify-center rounded-xl border-2 text-center',
              themeConfig
                ? undefined
                : cn(
                    'px-3 py-3 transition-all active:scale-95',
                    isSelected ? selectedBgClass : unselectedClass,
                    isDisabled && 'opacity-40 pointer-events-none',
                  ),
            )}
            style={
              themeConfig
                ? getThemedCardStyle(isSelected)
                : { minHeight: 64, touchAction: 'manipulation' }
            }
          >
            {/* Icon — rendered above label */}
            {item.icon && (
              <span
                className="mb-1 flex items-center justify-center"
                style={themeConfig ? getThemedTextStyle(isSelected) : undefined}
                aria-hidden="true"
              >
                {item.icon}
              </span>
            )}

            {/* Primary label */}
            <span
              className={cn(
                'font-semibold text-sm leading-snug',
                !themeConfig && (isSelected ? selectedLabelClass : ''),
              )}
              style={themeConfig ? getThemedTextStyle(isSelected) : undefined}
            >
              {item.label}
            </span>

            {/* Sublabel — e.g. price */}
            {item.sublabel !== undefined && (
              <span
                className={cn(
                  'text-sm font-bold mt-1',
                  !themeConfig &&
                    (isSelected ? selectedSublabelClass : 'text-gray-500 dark:text-gray-400'),
                )}
                style={themeConfig ? getThemedTextStyle(isSelected, true) : undefined}
              >
                {item.sublabel}
              </span>
            )}

            {/* Description — tertiary descriptor */}
            {item.description !== undefined && (
              <span
                className={cn(
                  'mt-1 leading-tight',
                  !themeConfig && 'text-xs text-gray-400 dark:text-gray-500',
                )}
                style={themeConfig ? themedDescStyle : undefined}
              >
                {item.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
