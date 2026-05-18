# Plan: Complete the `rc/` POS app to feature parity with desktop-react / mobile-app

> **Execution decision (locked):** All 5 phases documented here. Implementation now covers **Phase 1 + Phase 2 only**; phases 3/4/5 deferred to later sessions. Plan will also be copied to `D:\erp\pos\rc\PLAN.md` for project-local reference. Styling: **raw `StyleSheet`** (no NativeWind).

## Context

`rc/` (RN 0.75.5 + RNW 0.75.20 + WatermelonDB 0.28) is bootstrapped and running on Android: login, schema v2 (12 tables), nav shell (5 tabs + Items stack route), one-way item sync. Reference apps `desktop-react/` and `mobile-app/` already implement the full restaurant POS feature set against the same Laravel API.

Current `rc/` gaps vs reference:
- **Sync engine** pulls only `items`; missing `units`, `item_groups`, `item_variants`, `modifier_groups` + `modifiers`, `floor_plans`, `dining_tables`, `combos`, `orders`, `kots`.
- **Cart state** does not exist — no Zustand `cartStore`, no GST/round-off utilities.
- **Order lifecycle** missing entirely: no `orderActions` (create/sendKot/hold/unhold/cancel/checkout/resume).
- **Screens are skeletons** — TablesScreen reads an empty collection, BillingScreen is a grid with no cart, OrdersScreen/KitchenScreen show empty observers, SettingsScreen has no nav to reports/inventory.
- **Modals/components missing**: PaymentModal, VariantModifierModal, ChefNoteInput, TableCard, KotCard, SyncStatusBar, CustomerModal.
- **Reports, inventory item form, modifier/combo managers** — entire screens missing.

Goal: bring `rc/` to functional POS parity in 5 phases ordered by user value. Each phase delivers a usable slice; later phases assume earlier ones are merged.

---

## Phase 1 — Foundation (sync + utils + cart store)

The data layer must be complete before any UI work has anything to render.

### Files to create

| File | Purpose |
|------|---------|
| `src/lib/utils.ts` | `calcGST(taxable, rate, isInterState)`, `calcRoundOff(amt)`, `formatCurrency(n)` — copy from `desktop-react/src/lib/utils.ts` verbatim |
| `src/api/units.ts` | `unitsApi.list({status:'active', per_page:500})` |
| `src/api/itemGroups.ts` | `itemGroupsApi.list()` |
| `src/api/itemVariants.ts` | `itemVariantsApi.list({per_page:500})` |
| `src/api/modifierGroups.ts` | `modifierGroupsApi.list()`, `modifierGroupsApi.listModifiers()` (or use `/item-modifier-groups`) |
| `src/api/tables.ts` | `floorPlansApi.list()`, `diningTablesApi.list({is_active:1})`, `diningTablesApi.updateStatus(id,status)` |
| `src/api/orders.ts` | `ordersApi.list({per_page:200})`, `create`, `addLines`, `generateKot`, `hold`, `unhold`, `cancel`, `checkout`, `transferTable` |
| `src/api/kots.ts` | `kotsApi.list()`, `kotsApi.updateStatus(id,status)`, `kotsApi.updateLineStatus(kotId,lineId,status)` |
| `src/api/combos.ts` | `combosApi.list()` |
| `src/store/cartStore.ts` | mirror of `desktop-react/src/store/cartStore.ts`: `lines`, `localOrderId`, `orderId`, `orderType`, `tableId`, `tableName`, `totals` (subtotal/cgst/sgst/netPayable/roundOff); actions `addItem`, `updateQty`, `removeItem`, `setLineNotes`, `markLinesSent`, `setOrder`/`setLocalOrder`, `populateLines`, `clearOrder`, `clearCart`; recompute totals on every state change via `calcGST` |

### Files to modify

- `src/lib/syncEngine.ts` — extend `pullItems` into `pullAll`:
  - In sequence (each in own `database.write`): `units`, `item_groups`, `items`, `item_variants`, `modifier_groups` + `modifiers` (handle nested), `combos`, `floor_plans`, `dining_tables`, `orders` (paginated 200), `kots`.
  - Each entity: `Q.where('server_id', r.id)` to look up; skip if local `syncState === 'pending'`; UPDATE on hit, CREATE on miss; mark `synced`.
  - Update `runAllSyncs()` to call `pushPendingOrders()` (Phase 2 stub) + `pullAll()`.
  - Keep failed-push log at `console.log` level (already fixed).
- `src/screens/tabs/SettingsScreen.tsx` — show paginated `pulled` count from last sync (read from `syncStore.lastSyncAt` + new fields `lastPulled`, `lastPushed`).
- `src/store/syncStore.ts` — add `lastPulled: number`, `lastPushed: number`.

### Verification (Phase 1)

1. Pull-only test: log in fresh on the device, watch logcat for `[🍉]` schema log, then `[sync] pulled X units, Y item_groups, Z items, ...`. All 5 tabs should populate (Tables tab gets `dining_tables` cards, Kitchen still empty since no KOTs yet).
2. Quick db inspection: `adb shell run-as com.rc cat databases/rc.db | sqlite3 - ".tables"` — confirm all 12 tables non-empty.

---

## Phase 2 — POS billing flow (Tables → Cart → KOT → Payment)

The core money-making flow. Builds on Phase 1's reactive lists.

### Files to create

| File | Purpose |
|------|---------|
| `src/components/pos/TableCard.tsx` | Color-coded card (vacant=green / occupied=amber / reserved=blue / cleaning=red); shows name + status; `onPress` |
| `src/components/pos/Cart.tsx` | Right-pane cart: line list with qty +/–, line note button, trash; totals footer; "Send KOT" + "Payment" buttons |
| `src/components/pos/ItemCard.tsx` | POS grid card; shows price + unit + `NV{n}` badge for variants + `+ADD` badge for modifiers |
| `src/components/pos/VariantModifierModal.tsx` | Opens when `has_variants` or `has_modifiers`; reactive query for `item_variants` + `modifier_groups` + `modifiers`; required-variant disable rule; live price preview |
| `src/components/pos/PaymentModal.tsx` | Single mode (cash/upi/card/credit) + split mode; cash tendered → change calc; quick-cash buttons; validates split sum equals netPayable |
| `src/components/pos/ChefNoteInput.tsx` | Amber-bordered textarea for per-line note |
| `src/components/ui/SyncStatusBar.tsx` | Thin bar above tabs: `idle/syncing/error` with last sync time; tap to trigger sync |
| `src/lib/orderActions.ts` | `createLocalOrder({orderType, tableId?})` → WatermelonDB write + UUID; `addLineToCart(item, variant?, mods?)` Zustand-only; `sendKot(localOrderId)` writes `kots` + flags `order_lines.kotStatus='sent'` + fire-and-forget `POST /restaurant/orders/.../kot`; `holdOrder`, `unholdOrder`, `cancelOrder`, `checkoutOrder(localOrderId, CheckoutData)` mirror `desktop-react/src/lib/orderActions.ts` |

### Files to modify

- `src/screens/tabs/TablesScreen.tsx` — render floor-plan tabs + grid of `TableCard`s grouped by `floor_plan_server_id`; tap vacant → `createLocalOrder({orderType:'dine_in', tableId})` + navigate to Billing; tap occupied → resume via `findActiveByTableId` (local query).
- `src/screens/tabs/BillingScreen.tsx` — split view: left grid (existing) + right `Cart`; tap item → if variants/modifiers open `VariantModifierModal`, else `cartStore.addItem(item)`; "Send KOT" button → `orderActions.sendKot(localOrderId)`; "Pay" button → opens `PaymentModal` → on confirm `checkoutOrder`.
- `src/screens/tabs/OrdersScreen.tsx` — top-tab variant (Active / Held / All); read from `ordersCollection` with status filter; tap row → `navigate('OrderDetail', {orderId})`.

### Verification (Phase 2)

1. Tables tab shows real tables — tap a vacant one → BillingScreen opens with empty cart.
2. Add an item → cart updates instantly (Zustand only — no SQL until KOT). Tap qty +/–.
3. Tap item with variants → modal opens, select variant, "Add to Cart" enabled.
4. Send KOT → SQLite write happens (`order_lines.kotStatus='sent'`), a new row appears in Kitchen tab (Phase 3 verifies the UI, but the row is written now).
5. Pay → PaymentModal → Cash → 500 quick-button → Confirm → order disappears from Active, appears in OrderDetail with `confirmed`.
6. Server reflection: `GET /api/v1/restaurant/orders` from PowerShell — new order present with `status='confirmed'`.

---

## Phase 3 — Orders + Kitchen + Stack screens

Visibility into completed/in-flight orders and the KOT board.

### Files to create

| File | Purpose |
|------|---------|
| `src/screens/order/OrderDetailScreen.tsx` | Read `orders` + `order_lines` for id; show totals, payment mode; buttons: Resume (calls `unhold` + populate cart + nav Billing), Cancel, Reprint (no-op stub for now) |
| `src/components/kitchen/KotCard.tsx` | Dark card; shows KOT number + lines + status badge; tap to advance status (`new`→`in_progress`→`ready`→`served`) |

### Files to modify

- `src/screens/tabs/KitchenScreen.tsx` — dark kanban: 3 columns (new / in_progress / ready); `withObservables` on `kotsCollection.query(Q.where('status', Q.notEq('served')))`; tap card to advance via `kotsApi.updateStatus` + local write.
- `src/navigation/RootNavigator.tsx` — add `OrderDetail` screen (already in `RootStackParamList`).
- `src/screens/tabs/SettingsScreen.tsx` — add nav buttons: "Inventory", "Reports" → push corresponding stack screens.

### Verification (Phase 3)

1. After Phase 2 send-KOT, Kitchen tab shows the card in `new` column.
2. Tap → moves to `in_progress`. Server `PATCH /kots/{id}/status` succeeds (check logcat).
3. OrderList tab → tap a held order → OrderDetail → Resume → cart repopulates, navigate to Billing.

---

## Phase 4 — Inventory management (item CRUD, modifiers, combos)

Lower priority than the POS flow but needed for self-contained setup.

### Files to create

| File | Purpose |
|------|---------|
| `src/screens/inventory/InventoryMenuScreen.tsx` | Hub with 3 buttons → Items / Modifiers / Combos |
| `src/screens/inventory/ItemsScreen.tsx` | Replace current `src/screens/ItemsScreen.tsx`; reactive list with search; New Item button |
| `src/screens/inventory/ItemFormScreen.tsx` | Create/edit; name, unit dropdown (from `units` collection), price, CGST 2.5% / SGST 2.5% defaults, is_active; variants table (bulk save like electron-app's pattern); image upload deferred to Phase 5 |
| `src/screens/inventory/ModifiersScreen.tsx` | List + nested CRUD via `modifierGroupsApi.storeModifier` etc. |
| `src/screens/inventory/CombosScreen.tsx` | Combo list + create |
| `src/lib/inventoryActions.ts` | `upsertItem`, `upsertVariants`, `upsertModifierGroup`, `upsertCombo` — write local first, fire-and-forget API push |

### Files to modify

- `src/navigation/types.ts` — add `InventoryMenu`, `InventoryItems`, `InventoryItemForm`, `InventoryModifiers`, `InventoryCombos` to `RootStackParamList`.
- `src/navigation/RootNavigator.tsx` — register all 5 inventory screens.
- Delete old `src/screens/ItemsScreen.tsx` once `inventory/ItemsScreen.tsx` is wired.

### Verification (Phase 4)

1. Settings → Inventory → Items shows real items; New Item → save → row appears with `sync_state='pending'`, flips to `synced` after API push.
2. Create variant via inline table → server reflects after next sync.
3. Modifier group CRUD round-trips.

---

## Phase 5 — Reports + polish

Reports run as WatermelonDB SQL aggregations — no network calls required.

### Files to create

| File | Purpose |
|------|---------|
| `src/screens/reports/SalesScreen.tsx` | Date presets, KPI cards, by_order_type, daily table |
| `src/screens/reports/DayCloseScreen.tsx` | Single date, cash drawer summary, top 10 items |
| `src/screens/reports/ItemWiseScreen.tsx` | Date range, search, totals footer |
| `src/screens/reports/GstScreen.tsx` | Rate-slab breakup, CGST/SGST columns |
| `src/lib/reportQueries.ts` | WatermelonDB SQL aggregations — copy from `desktop-react/src/lib/reportQueries.ts` |

### Files to modify

- `src/navigation/types.ts` — add `ReportsSales`, `ReportsDayClose`, `ReportsItemWise`, `ReportsGst`.
- `src/navigation/RootNavigator.tsx` — register the 4 report screens.

### Polish (low-priority cleanups)

- Add `react-native-toast-message` for non-blocking success feedback (mirrors mobile-app).
- Replace `Alert.alert` confirmations with toast where appropriate.
- Add `pos-fresh`-style "reset local DB" button in Settings → useful during dev.
- Status bar offset: keep removed (Android edge-to-edge).

### Verification (Phase 5)

1. After completing a few test orders in Phase 2, open Reports → Sales → date = today → KPIs match the order count and revenue.
2. Day Close → totals tied out against payment_mode totals.
3. GST → CGST/SGST sum equals order tax totals.

---

## Cross-cutting / not in any phase

- **Image cache** — items have `image_url`; for now display directly via `<Image source={{uri}} />`. A local image cache (like electron-app's `media://`) is out of scope for Android — RN's built-in image cache is sufficient.
- **Customer (party) management** — defer; electron-app has it, mobile-app/desktop-react don't.
- **Printing** — no printer on Android; checkout success can show a printable receipt screen later.
- **NativeWind/Tailwind** — current `rc/` uses raw StyleSheet. Optional migration; mobile-app uses NativeWind. Decide before Phase 2 starts (refactor is much cheaper now).
- **TanStack Query** — desktop-react has `hooks/` using Query, but the golden rule says "All UI reads from WatermelonDB". `rc/` uses `withObservables` directly — keep it that way; skip Query.

---

## Critical files to read before implementing each phase

- `desktop-react/src/store/cartStore.ts` — exact shape to mirror in Phase 1
- `desktop-react/src/lib/orderActions.ts` — exact actions to port in Phase 2
- `desktop-react/src/lib/syncEngine.ts` — full pull sequence to port in Phase 1
- `desktop-react/src/components/pos/PaymentModal.tsx` — payment UX to port in Phase 2
- `desktop-react/src/components/pos/VariantModifierModal.tsx` — variant/modifier flow in Phase 2
- `desktop-react/src/lib/reportQueries.ts` — SQL aggregations in Phase 5
- `electron-app/src/main/db/repositories/OrderRepository.ts` — reference for offline-first writes

These are battle-tested in two other apps — minimal new code; mostly transcription with the `dbName='rc'` swap and any RN-Windows-isms removed (gesture-handler, async-storage instead of MMKV, etc.).

## Overall verification

End-to-end after all 5 phases:
1. Fresh install on a device, log in.
2. Wait for full sync (~5s on local API).
3. Tap a vacant table → add 2 items (one with variants) → Send KOT.
4. Go to Kitchen → advance KOT to ready → served.
5. Back to Billing → Pay split (cash + UPI) → confirm.
6. Reports → Sales → today shows ₹X with 1 order, 1 cash, 1 UPI.
7. Inventory → Items → create new item → next sync, server-side `GET /items` includes it.
8. Logout → log back in → all data still present (WatermelonDB persists).
