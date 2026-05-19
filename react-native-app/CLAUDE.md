# rc — React Native POS App

React Native 0.75.5 app (Android / iOS / Windows) with WatermelonDB, Zustand, and React Navigation.

---

## Directory Structure

```
rc/
├── App.tsx                        # Entry point — inits stores, renders RootNavigator
├── src/
│   ├── api/                       # Axios API clients (auth, items, orders, tables, etc.)
│   ├── components/
│   │   ├── Header.tsx             # Shared header with light/dark toggle button
│   │   ├── kitchen/
│   │   │   └── KotCard.tsx        # Reactive KOT card for kitchen display
│   │   └── pos/
│   │       ├── Cart.tsx           # Order cart with line items, qty controls, notes
│   │       ├── ItemCard.tsx       # Item grid card (name, price, VAR/+ADD badges)
│   │       ├── PaymentModal.tsx   # Checkout / payment flow
│   │       ├── TableCard.tsx      # Table status card (always-light pastel bg)
│   │       └── VariantModifierModal.tsx
│   ├── db/                        # WatermelonDB setup, schema, migrations, models
│   ├── lib/                       # Business logic: itemActions, orderActions, printer, syncEngine
│   ├── navigation/
│   │   ├── RootNavigator.tsx      # Stack navigator (Login → Tabs + modal screens)
│   │   └── TabNavigator.tsx       # Bottom tab navigator (Tables/Billing/Orders/Kitchen/Settings)
│   ├── screens/
│   │   ├── ItemsScreen.tsx        # Manage items (modal stack screen)
│   │   ├── auth/LoginScreen.tsx
│   │   ├── order/OrderDetailScreen.tsx
│   │   ├── settings/PrinterScreen.tsx
│   │   └── tabs/
│   │       ├── BillingScreen.tsx  # Main POS: item grid + cart drawer + payment
│   │       ├── KitchenScreen.tsx  # Kanban KOT display (new / cooking / ready)
│   │       ├── OrdersScreen.tsx   # Order list with active / held / all tabs
│   │       ├── SettingsScreen.tsx # Account, server URL, sync, printer nav
│   │       └── TablesScreen.tsx   # Floor plan tabs + table grid
│   ├── store/
│   │   ├── authStore.ts           # User, token, serverUrl (AsyncStorage)
│   │   ├── cartStore.ts           # Cart lines, order type, totals
│   │   ├── printerStore.ts        # Printer config (AsyncStorage)
│   │   ├── syncStore.ts           # Sync status / last sync time
│   │   └── themeStore.ts          # Light/dark theme (AsyncStorage, key: 'theme')
│   └── theme/
│       └── index.ts               # Theme type + lightTheme + darkTheme token objects
```

---

## Theme System

### Files
| File | Purpose |
|------|---------|
| `src/theme/index.ts` | `Theme` type, `lightTheme`, `darkTheme` color token objects |
| `src/store/themeStore.ts` | Zustand store — `isDark`, `toggle()`, `setDark()`, `initThemeStore()`, `useTheme()` |
| `src/components/Header.tsx` | Reusable header — shows `☾` (go dark) or `☀` (go light) toggle button |

### How to use theme in any component

```ts
import {useTheme} from '@/src/store/themeStore';

function MyComponent() {
  const theme = useTheme(); // returns lightTheme or darkTheme object

  return (
    <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
      <Text style={{color: theme.textPrimary}}>Hello</Text>
    </View>
  );
}

// Keep layout-only props in StyleSheet.create — only color tokens go inline
const styles = StyleSheet.create({
  card: {borderRadius: 8, borderWidth: 1, padding: 12},
});
```

### Theme token reference

| Token | Light | Dark | Use for |
|-------|-------|------|---------|
| `bg` | `#f8fafc` | `#0f172a` | Screen background |
| `surface` | `#ffffff` | `#1e293b` | Cards, headers, modals |
| `surfaceAlt` | `#f1f5f9` | `#334155` | Raised surfaces, tab bars |
| `textPrimary` | `#0f172a` | `#f1f5f9` | Main text |
| `textSecondary` | `#64748b` | `#94a3b8` | Labels, meta text |
| `textMuted` | `#94a3b8` | `#64748b` | Placeholders, hints |
| `primary` | `#0ea5e9` | `#0ea5e9` | Buttons, active states (same in both) |
| `border` | `#e2e8f0` | `#334155` | Dividers, card borders |
| `borderLight` | `#f1f5f9` | `#1e293b` | Subtle row separators |
| `statusBarStyle` | `dark-content` | `light-content` | StatusBar |
| `scrim` | `rgba(15,23,42,0.45)` | `rgba(0,0,0,0.6)` | Modal backdrop |

### Key rules

1. **`StyleSheet.create` is static** — never put color tokens there. Apply them as inline style overrides:
   ```ts
   style={[styles.screen, {backgroundColor: theme.bg}]}
   ```

2. **`useTheme()` must be called inside the inner component** when using `withObservables` HOC — not in the HOC wrapper itself.

3. **`TextInput` needs two color props**: `style={{color: theme.textPrimary}}` AND `placeholderTextColor={theme.textMuted}`.

4. **`TableCard` is an exception** — its bg is always a light pastel status color (`#fef3c7`, `#dcfce7`, etc.) regardless of theme. The table name text is hardcoded dark (`#0f172a`) so it stays readable in dark mode.

5. **BillingScreen `summaryBar`** is intentionally always dark (`#0f172a` bg) in both themes — it's a branded action strip.

6. **Persist** — theme choice survives app restarts via AsyncStorage key `'theme'` → `'dark' | 'light'`.

### Adding the Header to a new screen

```tsx
import Header from '@/src/components/Header';

// Basic
<Header title="My Screen" />

// With subtitle + extra button on the right
<Header
  title="Billing"
  subtitle="dine in"
  right={<TouchableOpacity onPress={...}><Text>Action</Text></TouchableOpacity>}
/>

// Hide toggle (e.g. login screen)
<Header title="Login" showToggle={false} />
```

---

## State Management

All stores follow the same pattern as `printerStore.ts`:
- Zustand `create()` with no persistence middleware
- Manual `AsyncStorage` read/write
- Exported `init*Store()` function called from `App.tsx` `useEffect`

```ts
// App.tsx — all stores inited in parallel before render
await Promise.all([initAuthStore(), initPrinterStore(), initThemeStore()]);
```

---

## Navigation

```
RootNavigator (Stack)
├── Login          — headerShown: false
└── Tabs           — headerShown: false
    ├── Tables     → TablesScreen
    ├── Billing    → BillingScreen
    ├── Orders     → OrdersScreen
    ├── Kitchen    → KitchenScreen
    └── Settings   → SettingsScreen
    (modal stack screens, native header themed via RootNavigator sharedHeaderOptions)
    ├── Items      → ItemsScreen
    ├── OrderDetail → OrderDetailScreen
    └── PrinterSettings → PrinterScreen
```

Native stack headers (Items, OrderDetail, PrinterSettings) are themed via `sharedHeaderOptions` in `RootNavigator.tsx` — `headerStyle.backgroundColor`, `headerTintColor`, `headerTitleStyle` all read from `useTheme()`.

---

## Styling Conventions

- **No Tailwind / CSS** — pure `StyleSheet.create` + inline style overrides
- **Color tokens** always applied inline, never in `StyleSheet.create`
- **Layout** (flex, padding, borderRadius, fontSize) goes in `StyleSheet.create`
- **Minimum touch target**: 44×44 px for all interactive elements
- **Status / semantic colors** (amber, blue, green, red for KOT status, table status, sync badges) are hardcoded and do not change with theme
