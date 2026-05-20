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

---

## Offline-First Architecture

### What is offline-first

WatermelonDB is the local SQLite store. All reads come from local DB via reactive `withObservables` queries. Writes use a **local-first + fire-and-forget** pattern: write locally first (instant), then push to server in a `setTimeout(async () => { ... }, 0)` block. The sync engine pulls data from the server every 30 minutes and on demand.

### What is already offline-first ✓

| Feature | Pattern |
|---------|---------|
| Billing / item browse | Reactive WatermelonDB — works fully offline |
| Start order, add to cart | Zustand only — no DB writes until KOT/hold/checkout |
| Send KOT | Local write first → fire-and-forget server push |
| Hold / unhold / cancel order | Local write first → fire-and-forget server push |
| Checkout / payment | Local write first → fire-and-forget server push |
| KOT status advance (kitchen) | Local write first → fire-and-forget server push |
| Tables / orders / kitchen display | Reactive WatermelonDB |
| Reports (Sales, Day Close, Item-wise, GST) | All computed from local WatermelonDB — fully offline |
| Item create/edit/delete (Inventory) | Local write first → fire-and-forget server push |

### Known offline-first gaps ✗

#### Critical — blocks the user if offline

**1. `TableManagerScreen` — floor plan and table CRUD are server-first**
- Files: `src/screens/settings/TableManagerScreen.tsx` — `FloorPlanModal.handleSave()`, `TableModal.handleSave()`, `BulkCreateModal.handleCreate()`, `confirmDeleteFloor()`, `confirmDeleteTable()`
- Pattern: API call happens first and blocks; local DB write only happens after server responds. If offline, the modal shows "Server error" and the write is lost entirely.
- Fix needed: write locally with `sync_state = 'pending'` first, then push to server fire-and-forget (same pattern as `orderActions.ts`).

**2. `InventoryItemFormScreen` — units and item groups fetched from API on mount**
- File: `src/screens/inventory/InventoryItemFormScreen.tsx` lines 86–103
- `apiClient.get('/units?...')` and `apiClient.get('/item-groups')` are called directly. Units fall back to `FALLBACK_UNITS` if offline, but item groups become empty (group picker broken offline).
- Also: item group name resolution when editing calls the API again (line 119).
- Fix needed: read from local WatermelonDB `units` and `item_groups` tables instead — both are populated by the sync engine.

#### Major — silent failures, data not synced

**3. No push queue for pending orders/kots/holds/cancels**
- File: `src/lib/syncEngine.ts` — `pushPendingItems()` only pushes items with `sync_state = 'pending'`
- `holdOrder`, `unholdOrder`, `cancelOrder`, `advanceKotStatus` all set `sync_state = 'pending'` but there is no corresponding push pass for orders/kots (comment in code: `// retried on next sync push (not implemented yet)`).
- Fire-and-forget failures for these operations are silently swallowed with empty `catch {}`.
- Fix needed: add `pushPendingOrders()` and `pushPendingKots()` passes to `runAllSyncs()`.

**4. Variants created for locally-pending items not pushed**
- File: `src/screens/inventory/InventoryItemFormScreen.tsx` — `handleAddVariant()`
- `createVariant({item_id: localItem.serverId!})` is called even when `serverId` is a `local_xxx` placeholder, causing a silent server error. `pushPendingItems` doesn't cover item variants.
- Fix needed: check `serverId.startsWith('local_')` before API call; add `pushPendingItemVariants()` to sync engine.

#### Minor — UX issues

**5. No network status indicator / reconnect trigger**
- There is no `NetInfo` usage. The app gives no visual feedback that it is offline, and the sync scheduler runs on a 30-minute timer only — it does not re-trigger on network reconnect.
- Fix needed: integrate `@react-native-community/netinfo` to show an offline banner and call `triggerSyncNow()` on reconnect.

**6. "Sync first" message on occupied table with no local order**
- File: `src/screens/tabs/TablesScreen.tsx` line 63
- `Alert.alert('No local order', 'No matching order found locally yet — sync first.')` — this surfaces when an occupied table's order was created on another device and not yet pulled locally. Poor offline UX.
- Fix needed: trigger a sync automatically and retry, or at least offer a "Sync now" button in the alert.

**7. Sync interval is 30 minutes**
- File: `src/lib/syncEngine.ts` line 40 — `SYNC_INTERVAL_MS = 30 * 60 * 1000`
- For a restaurant POS, 30 minutes is too long — orders from other devices (cashier, other waitstaff) will not appear on the kitchen screen for up to 30 minutes without a manual sync.
- Fix needed: reduce to 60–90 seconds for orders/kots, keep 30 min for catalog (items/groups/units).

### Pattern to follow for new server-first features

Any write operation that currently blocks on the network should follow `orderActions.ts` as the reference implementation:

```ts
// 1. Local write — instant, always succeeds
await database.write(async () => {
  await collection.create(rec => {
    rec.serverId = null;          // no server ID yet
    rec.syncState = 'pending';    // marks it for the push queue
    // ... other fields
  });
});

// 2. Fire-and-forget — network optional
setTimeout(async () => {
  try {
    const remote = await api.create({ ... });
    await database.write(async () => {
      await record.update(rec => {
        rec.serverId = remote.id;
        rec.syncState = 'synced';
      });
    });
  } catch {
    // will be retried by pushPending* on next sync
  }
}, 0);
```
