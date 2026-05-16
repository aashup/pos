import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ipc } from '../bridge/ipc'

export interface ShortcutDef {
  key: string           // e.g. 'F1', 'F2', 'Escape', 'Enter'
  label: string         // for future help-overlay display
  altKey?: boolean      // require Alt to be held
  guard?: () => boolean // return false to skip action
  action: () => void
}

// ── Module-level singleton ─────────────────────────────────────────────────
//
// One global keydown listener for the entire app lifetime.
// Each key has a stack of registrations; the *last* (top) entry is active.
// Removing an entry (on unmount) automatically restores the previous one.

type StackEntry = ShortcutDef & { _token: symbol }
const stacks = new Map<string, StackEntry[]>()
let _listenerInstalled = false

function stackKey(def: Pick<ShortcutDef, 'key' | 'altKey'>): string {
  return def.altKey ? `Alt+${def.key}` : def.key
}

function ensureListener(): void {
  if (_listenerInstalled || typeof window === 'undefined') return
  _listenerInstalled = true
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const key = e.altKey ? `Alt+${e.key}` : e.key
    const stack = stacks.get(key)
    if (!stack?.length) return
    const top = stack[stack.length - 1]
    if (top.guard && !top.guard()) return
    e.preventDefault()
    top.action()
  })
}

function registerShortcuts(defs: ShortcutDef[]): symbol[] {
  ensureListener()
  return defs.map((def) => {
    const token = Symbol()
    const k = stackKey(def)
    const existing = stacks.get(k) ?? []
    stacks.set(k, [...existing, { ...def, _token: token }])
    return token
  })
}

function unregisterShortcuts(defs: ShortcutDef[], tokens: symbol[]): void {
  defs.forEach((def, i) => {
    const token = tokens[i]
    const k = stackKey(def)
    const existing = stacks.get(k) ?? []
    const updated = existing.filter((e) => e._token !== token)
    if (updated.length) stacks.set(k, updated)
    else stacks.delete(k)
  })
}

// ── useKeyboardShortcuts ───────────────────────────────────────────────────
//
// Register a set of shortcuts for the lifetime of the calling component.
// `shortcuts` MUST be stable — wrap with useMemo at the call site.
//
// Conflict resolution: if two components register the same key, the one
// mounted *later* wins. When it unmounts, the earlier registration is
// automatically restored — no manual cleanup needed.

export function useKeyboardShortcuts(shortcuts: ShortcutDef[]): void {
  useEffect(() => {
    const tokens = registerShortcuts(shortcuts)
    return () => unregisterShortcuts(shortcuts, tokens)
  }, [shortcuts])
}

// ── useGlobalShortcuts ────────────────────────────────────────────────────
//
// Call once from AppRoutes (always mounted, inside HashRouter).
// Registers app-wide shortcuts with router-awareness.
//
//   F1        → /pos/tables          (all pages)
//   F3        → shortcut:send-kot    (billing page only, via CustomEvent)
//   F4        → shortcut:payment     (billing page only, via CustomEvent)
//   F5        → sync trigger          (all pages)
//   Esc       → shortcut:escape       (billing page only, via CustomEvent)
//   Alt+Enter → toggle fullscreen     (all pages)
//
// BillingScreen listens for the CustomEvents to call its local handlers.

export function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const location = useLocation()

  const shortcuts = useMemo<ShortcutDef[]>(() => {
    const onBilling = location.pathname === '/pos/tables'
    return [
      {
        key: 'F1',
        label: 'Table Selection',
        action: () => navigate('/pos/tables'),
      },
      {
        key: 'F3',
        label: 'Send KOT',
        guard: () => onBilling,
        action: () => window.dispatchEvent(new CustomEvent('shortcut:send-kot')),
      },
      {
        key: 'F4',
        label: 'Payment',
        guard: () => onBilling,
        action: () => window.dispatchEvent(new CustomEvent('shortcut:payment')),
      },
      {
        key: 'F5',
        label: 'Sync Now',
        action: () => { ipc.sync.trigger() },
      },
      {
        key: 'Escape',
        label: 'Close modal',
        guard: () => onBilling,
        action: () => window.dispatchEvent(new CustomEvent('shortcut:escape')),
      },
      {
        key: 'Enter',
        altKey: true,
        label: 'Toggle Fullscreen',
        action: () => { ipc.window.toggleFullscreen() },
      },
    ]
  }, [location.pathname, navigate])

  useKeyboardShortcuts(shortcuts)
}
