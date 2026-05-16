# Zazzy Mobile — React Native POS

Full-featured waitstaff + kitchen POS for tableside ordering, kitchen display, reports, and inventory management. Expo SDK 54 + Development Build. Connects to the same Laravel backend as the Zazzy POS desktop app.

---

## Three-Layer Data Architecture — THE GOLDEN RULE

Every feature in this app must follow this strict layering. No exceptions.

```
Layer 1: State     → Zustand        (in-memory, real-time UI state only)
Layer 2: Local DB  → WatermelonDB   (offline-first; THE source of truth for all reads)
Layer 3: Master DB → Laravel API    (server source of truth; sync target)
```

**Rules:**
- **All UI reads from WatermelonDB** — never read from TanStack Query cache in UI components
- **All mutations write to WatermelonDB first** (`sync_status='pending'`), then fire-and-forget push to API
- **API pull syncs upsert** into WatermelonDB; skip any row where local `sync_status === 'pending'`
- **Reports** are computed from WatermelonDB aggregations — offline-capable; sync pull triggered before computation
- **Inventory CRUD** writes to WatermelonDB first, pushes to API in background

TanStack Query is used **only as a sync orchestrator** — it fetches from API and writes to WatermelonDB. It is never a UI data source.

---

## Directory Layout

```
mobile-app/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx             # Root Stack: providers + startSyncScheduler() on mount
│   ├── index.tsx               # Redirect → (tabs) or (auth)/login based on token
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx         # 5 tabs: Tables | Billing | Orders | Kitchen | Settings
│   │   ├── tables.tsx          # Floor plan + table grid + QR scan; occupied tap → resume order
│   │   ├── billing.tsx         # Item grid + cart + order type + GST totals + PaymentModal
│   │   ├── orders.tsx          # Active / Held / All segmented; rows → order/[id]
│   │   ├── kitchen.tsx         # Dark kanban: New | In Progress | Ready (KotCards)
│   │   └── settings.tsx        # Server URL, sync status, links to Reports + Inventory
│   ├── order/
│   │   └── [id].tsx            # Order detail: lines, GST, payment, Resume/Cancel/Share
│   ├── reports/
│   │   ├── sales.tsx           # Sales summary (today/yesterday/7d/30d)
│   │   ├── day-close.tsx       # Day close with date nav
│   │   ├── item-wise.tsx       # Item-wise revenue + search
│   │   └── gst.tsx             # GST by rate slab
│   └── inventory/
│       ├── index.tsx           # Menu → Items / Modifiers / Combos
│       ├── items.tsx           # Item list (reactive, search, delete)
│       ├── item/[id].tsx       # Item create/edit + inline variants (id='new' for create)
│       ├── modifiers.tsx       # Modifier groups + modifiers (collapsible, CRUD)
│       └── combos.tsx          # Combo meals + item picker
├── src/
│   ├── api/                    # Axios functions — called after local DB writes
│   │   ├── client.ts           # Axios instance; reads token + serverUrl from MMKV
│   │   ├── auth.ts             # login()
│   │   ├── items.ts            # fetchItems(), fetchItemGroups(), fetchItemVariants(),
│   │   │                       # fetchModifierGroups(), fetchUnits()
│   │   ├── tables.ts           # fetchFloorPlans(), fetchDiningTables()
│   │   ├── orders.ts           # createOrder(), addOrderLines(), checkoutOrder(),
│   │   │                       # holdOrder(), unholdOrder(), cancelOrder()
│   │   ├── kots.ts             # updateKotStatus(serverKotId, status) — PATCH
│   │   └── inventory.ts        # CRUD for items, variants, modifier groups,
│   │                           # modifiers, combos
│   ├── db/
│   │   ├── index.ts            # WatermelonDB singleton with migrations + all 14 modelClasses
│   │   ├── schema.ts           # Schema v2 — 14 tables
│   │   ├── migrations.ts       # v1→v2 migration (addColumns + createTable)
│   │   └── models/
│   │       ├── Item.ts         # gstRate, cgstPct, sgstPct, unit, sku, hasVariants, hasModifiers
│   │       ├── ItemGroup.ts
│   │       ├── ItemVariant.ts  # serverId, itemServerId, name, price, isActive, syncStatus
│   │       ├── FloorPlan.ts
│   │       ├── DiningTable.ts
│   │       ├── Order.ts        # orderType, paymentMode, amountPaid, cgstTotal, sgstTotal, ...
│   │       ├── OrderLine.ts    # kotStatus, gstRate, variantId, variantName, kotId
│   │       ├── Kot.ts          # orderId, status (new|in_progress|ready|served), syncStatus
│   │       ├── ModifierGroup.ts # serverId, isRequired, minSelections, maxSelections
│   │       ├── Modifier.ts     # modifierGroupId, name, price, sortOrder, isActive
│   │       ├── Unit.ts         # serverId, value, label, status
│   │       ├── Combo.ts        # serverId, name, price, isActive, syncStatus
│   │       ├── ComboItem.ts    # comboServerId, itemServerId, quantity
│   │       └── LocationLog.ts  # device-local only; never synced
│   ├── hooks/                  # TanStack Query hooks — fetch API → write WatermelonDB
│   │   ├── useItemsSync.ts     # Items + item groups; skips pending local rows
│   │   ├── useTablesSync.ts    # Floor plans + dining tables
│   │   ├── useOrdersSync.ts    # Orders + order lines; skips pending
│   │   ├── useVariantsSync.ts  # item_variants; paginated; purges deleted
│   │   ├── useModifierGroupsSync.ts  # modifier_groups + modifiers nested
│   │   ├── useUnitsSync.ts     # units table
│   │   └── useCombosSync.ts    # combos + combo_items; silent 404 if endpoint missing
│   ├── store/
│   │   ├── authStore.ts        # Zustand + MMKV; token, serverUrl; getAuthStore() for axios
│   │   ├── cartStore.ts        # In-memory cart: lines (with GST fields, kotStatus),
│   │   │                       # orderType, computeTotals() → subtotal/cgst/sgst/roundOff/netPayable
│   │   └── syncStore.ts        # { status, lastSyncAt, errors } — read by SyncStatusBar + settings
│   ├── lib/
│   │   ├── orderActions.ts     # sendKot(), checkout(), holdOrder(), cancelOrder(),
│   │   │                       # unholdOrder(), resumeOrderIntoCart(), updateKotStatus()
│   │   ├── syncEngine.ts       # startSyncScheduler() / stopSyncScheduler() / runAllSyncs()
│   │   │                       # 30-min interval + AppState foreground re-sync
│   │   ├── reportQueries.ts    # computeSalesSummary(), computeDayClose(),
│   │   │                       # computeItemWise(), computeGstSummary() — WatermelonDB SQL
│   │   ├── locationService.ts  # Background geolocation start/stop
│   │   ├── queryClient.ts      # TanStack QueryClient singleton
│   │   └── utils.ts            # cn(), formatCurrency(), calcGST(), calcRoundOff()
│   └── components/
│       ├── pos/
│       │   ├── ItemCard.tsx
│       │   ├── TableCard.tsx
│       │   ├── PaymentModal.tsx        # Cash/UPI/Card/Credit + split + change display
│       │   ├── VariantModifierModal.tsx # Reads WatermelonDB; radio variants + multi-select mods
│       │   └── ChefNoteInput.tsx       # Per-line note; read-only after KOT sent
│       ├── kitchen/
│       │   └── KotCard.tsx             # KOT kanban card with status action buttons
│       ├── scanner/
│       │   └── BarcodeScanner.tsx
│       └── ui/
│           └── SyncStatusBar.tsx       # Shows syncing / last sync time / errors
├── app.config.js
├── babel.config.js         # Decorators (legacy: true) + NativeWind babel plugin
├── metro.config.js         # withNativeWind() wrapper
└── tailwind.config.js      # nativewind/preset
```

---

## How to Run

```bash
cd mobile-app

# Android dev build (physical device or emulator)
npm run android       # expo run:android

# iOS dev build (Mac only)
npm run ios           # expo run:ios

# Start Metro bundler only (if native already built)
npm start             # expo start
```

> **Development Build required** — this app cannot run in Expo Go. WatermelonDB, VisionCamera, and Background Geolocation all require native modules.

---

## Critical Architecture Decisions

### `newArchEnabled: false` in app.config.js — DO NOT CHANGE
WatermelonDB JSI is incompatible with React Native 0.81's New Architecture. Changing this will break the database.

### Cart state is Zustand only
Cart lines live in Zustand (in-memory). WatermelonDB is written only when:
- KOT is sent (`sendKot()`) — creates a `kots` row + links `order_lines` via `kot_id`
- Order is checked out (`checkout()`) — writes payment fields to `orders` row
- Order is held (`holdOrder()`)

### Sync engine lifecycle
`startSyncScheduler()` is called once in `app/_layout.tsx` `useEffect`. It:
1. Runs `runAllSyncs()` immediately
2. Re-runs on `AppState` change to `'active'` (app foregrounded)
3. Re-runs every 30 minutes via `setInterval`

`runAllSyncs()` refetches all TanStack Query keys and then calls `pushPendingOrders()` fire-and-forget.

### Write-local-then-sync-async pattern
All mutations (orders, inventory) write to WatermelonDB first with `sync_status='pending'`, then fire a network call. Never block UI on network. See `src/lib/orderActions.ts` and inventory screens.

### Never overwrite pending local rows on pull sync
All sync hooks (`useItemsSync`, `useOrdersSync`, etc.) skip server rows when local `sync_status === 'pending'`. This prevents server overwrites of in-flight local changes.

### Reports are computed from local DB — no dedicated API
All four report screens call `runAllSyncs()` first, then compute aggregations from WatermelonDB via raw SQL in `src/lib/reportQueries.ts`. This means reports work offline after any prior sync.

### Location logs are device-local only
`location_logs` table has a `synced` column that is always `false`. There is no backend endpoint for location data. Never attempt to sync it.

---

## WatermelonDB Schema (v2)

Schema version is `2`. Pass `migrations` from `src/db/migrations.ts` to the `SQLiteAdapter` in `src/db/index.ts`. During development, wipe and reinstall the app to apply migrations (`expo run:android`).

| Model | Table | Key fields |
|-------|-------|------------|
| `Item` | `items` | `serverId`, `name`, `price`, `gstRate`, `cgstPct`, `sgstPct`, `unit`, `sku`, `hasVariants`, `hasModifiers`, `isActive` |
| `ItemGroup` | `item_groups` | `serverId`, `name` |
| `ItemVariant` | `item_variants` | `serverId`, `itemServerId`, `name`, `price`, `isActive`, `syncStatus` |
| `FloorPlan` | `floor_plans` | `serverId`, `name` |
| `DiningTable` | `dining_tables` | `serverId`, `floorPlanId`, `name`, `status`, `currentOrderId` |
| `Order` | `orders` | `serverId`, `tableId`, `status`, `syncStatus`, `totalAmount`, `orderType`, `paymentMode`, `amountPaid`, `amountTendered`, `changeAmount`, `cgstTotal`, `sgstTotal`, `discountAmount` |
| `OrderLine` | `order_lines` | `orderId`, `itemId`, `itemName`, `quantity`, `price`, `sent`, `kotStatus`, `gstRate`, `variantId`, `variantName`, `modifiersTotal`, `kotId`, `note` |
| `Kot` | `kots` | `serverId`, `orderId`, `status` (new\|in_progress\|ready\|served), `createdAt`, `syncStatus` |
| `ModifierGroup` | `modifier_groups` | `serverId`, `name`, `itemServerId`, `minSelections`, `maxSelections`, `isRequired`, `syncStatus` |
| `Modifier` | `modifiers` | `serverId`, `modifierGroupId`, `name`, `price`, `sortOrder`, `isActive`, `syncStatus` |
| `Unit` | `units` | `serverId`, `value`, `label`, `status` |
| `Combo` | `combos` | `serverId`, `name`, `price`, `isActive`, `syncStatus` |
| `ComboItem` | `combo_items` | `comboServerId`, `itemServerId`, `quantity` |
| `LocationLog` | `location_logs` | `latitude`, `longitude`, `accuracy`, `recordedAt`, `synced` (always false) |

---

## Key Utility Functions

**`src/lib/utils.ts`**
- `formatCurrency(amount)` — formats as `₹X.XX`
- `calcGST(taxable, cgstPct, sgstPct)` → `{ cgst, sgst }`
- `calcRoundOff(amount)` → `{ netPayable, roundOff }` (round to nearest ₹1)

**`src/lib/orderActions.ts`**
- `sendKot()` — creates `kots` WatermelonDB row, marks unsent `order_lines` as sent, fire-and-forget `POST /kot`
- `checkout(paymentData)` — writes payment fields to order, fire-and-forget `POST /checkout`
- `holdOrder(localOrderId)` — sets status='held', fire-and-forget `POST /hold`
- `unholdOrder(localOrderId)` — sets status='open', loads lines into cartStore, fire-and-forget `POST /unhold`
- `cancelOrder(localOrderId)` — sets status='cancelled', frees table, fire-and-forget `POST /cancel`
- `resumeOrderIntoCart(localOrderId)` — loads order + lines into cartStore without a server call
- `updateKotStatus(kotLocalId, status)` — writes to `kots` local, fire-and-forget PATCH to server

**`src/store/cartStore.ts`**
- `addItem(item, qty, variantId?, variantName?, modifiers?)` — deduplicates by itemId+variantId only if no modifiers and not yet sent
- `computeTotals()` → `{ subtotal, cgstTotal, sgstTotal, roundOff, netPayable, unsentCount }`
- `populateLines(lines, localOrderId)` — used by `resumeOrderIntoCart` to restore open orders

---

## Backend API Endpoints

All under `/api/v1/` with `Authorization: Bearer <token>`. Server URL set in Settings, stored in MMKV.

| Endpoint | Used for |
|----------|---------|
| `POST /login` | Auth |
| `GET /floor-plans` | Floor plan sync |
| `GET /dining-tables?is_active=1` | Table sync |
| `GET /items?per_page=200&page=N` | Item sync (paginated) |
| `GET /item-groups` | Category sync |
| `GET /item-variants?per_page=200&page=N` | Variant sync |
| `GET /modifier-groups?per_page=200&page=N` | Modifier group sync (modifiers nested) |
| `GET /units?status=active&per_page=500` | Unit sync |
| `GET /combos` | Combo sync |
| `POST /restaurant/orders` | Create order |
| `POST /restaurant/orders/{id}/lines` | Add order lines |
| `POST /restaurant/orders/{id}/kot` | Send to kitchen |
| `POST /restaurant/orders/{id}/checkout` | Payment + close |
| `POST /restaurant/orders/{id}/hold` | Hold order |
| `POST /restaurant/orders/{id}/unhold` | Unhold order |
| `POST /restaurant/orders/{id}/cancel` | Cancel order |
| `PATCH /kots/{id}` | Update KOT status from kitchen display |
| `POST /items` | Create item |
| `PATCH /items/{id}` | Update item |
| `DELETE /items/{id}` | Soft-delete item |
| `POST /item-variants` | Create variant |
| `PATCH /item-variants/{id}` | Update variant |
| `DELETE /item-variants/{id}` | Delete variant |
| `POST /modifier-groups` | Create modifier group |
| `PATCH /modifier-groups/{id}` | Update modifier group |
| `DELETE /modifier-groups/{id}` | Delete modifier group |
| `POST /modifiers` | Create modifier option |
| `PATCH /modifiers/{id}` | Update modifier option |
| `DELETE /modifiers/{id}` | Delete modifier option |
| `POST /combos` | Create combo |
| `PATCH /combos/{id}` | Update combo |
| `DELETE /combos/{id}` | Delete combo |

---

## Critical Version Constraints — DO NOT CHANGE

| Package | Version | Why |
|---------|---------|-----|
| `nativewind` | ^4.2.3 | v4 uses `withNativeWind()` metro wrapper — v2/v3 pattern silently breaks |
| `tailwindcss` | ^3.4.x | NativeWind v4 requires Tailwind v3, NOT v4 |
| `react-native-vision-camera` | ^5.x | Use built-in `useCodeScanner` hook — do NOT add `vision-camera-code-scanner` (that's v2/v3) |
| `@babel/plugin-proposal-decorators` | `{ legacy: true }` | Required for WatermelonDB `@field()` decorators |
| `newArchEnabled` | `false` | WatermelonDB JSI compatibility |

---

## NativeWind Setup (v4)

Three parts that must all be present:
1. `metro.config.js` — `withNativeWind(config, { input: './global.css' })`
2. `babel.config.js` — `jsxImportSource: 'nativewind'` in preset + `'nativewind/babel'` plugin
3. `tailwind.config.js` — `require('nativewind/preset')` in presets

If styles silently don't apply, check all three files.

---

## Barcode / QR Scanning

- **Table QR codes** encode the table's `server_id` (backend UUID) → look up by `Q.where('server_id', value)`
- **Item barcodes** look up by `Q.where('barcode', value)` in WatermelonDB `items`
- Must be tested on a physical device — emulator cameras are unreliable

---

## Background Geolocation

Requires a paid license from Transistor Software. Add key to `.env`:
```
BACKGROUND_GEOLOCATION_LICENSE=your_key_here
```
Config: `distanceFilter: 50` (native 50 m guard) + JS haversine check as secondary guard. `heartbeatInterval: 600` (10 min on iOS). Android foreground service enabled. Location data is **device-local only** — never synced.
