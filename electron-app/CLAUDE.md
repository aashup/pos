# Zazzy POS — Electron App

## ⚠️ Critical Fixes — Never Revert

### 1. better-sqlite3 must be v11+
```
"better-sqlite3": "^11.0.0"   ← NOT ^9.x
```
v9 fails with Electron 32: `C++20 or later required`, `no template named 'CopyablePersistentTraits' in namespace 'v8'`.
After changing version: `npx electron-rebuild -f -w better-sqlite3`

### 2. electron-store must be v8
```
"electron-store": "^8.1.0"   ← NOT ^10
```
v10 is ESM-only. CJS main process can't `require()` it.

### 3. schema.sql must use Vite `?raw` import
```typescript
// src/main/db/database.ts
import schema from './schema.sql?raw'   // ← inlined as string at build time
db.exec(schema)
// NOT: readFileSync(join(__dirname, 'schema.sql'))  ← ENOENT in packaged build
```
electron-vite does not copy non-JS assets to `out/main/`.

---

## Directory Structure

```
src/
├── main/
│   ├── index.ts              # app entry: createWindow, initDatabase, IPC, SyncScheduler, autoUpdater
│   ├── ipc/
│   │   └── ipcHandlers.ts    # ALL IPC channel registrations
│   ├── db/
│   │   ├── database.ts       # better-sqlite3 singleton (getDb, initDatabase)
│   │   ├── schema.sql        # CREATE TABLE IF NOT EXISTS (idempotent, runs every startup)
│   │   └── repositories/
│   │       ├── ItemRepository.ts   # search(), getGroups(), getAll(), getAllForPOS(), upsert(), upsertGroup()
│   │       ├── TableRepository.ts  # getAll(), getFloorPlans(), upsert(), upsertFloorPlan()
│   │       └── UnitRepository.ts   # getAll(), upsert()
│   ├── sync/
│   │   ├── SyncEngine.ts     # orchestrates push+pull, broadcasts sync:status-changed
│   │   ├── SyncScheduler.ts  # 30s foreground / 300s background setInterval
│   │   ├── PullWorker.ts     # pulls units, item_groups, items, floor_plans, dining_tables, godowns
│   │   └── PushWorker.ts     # pushes sales_invoices with sync_status='pending'
│   ├── print/
│   │   ├── ThermalPrinter.ts # receipt builder (node-thermal-printer)
│   │   └── KotPrinter.ts     # KOT slip builder
│   └── auth/
│       └── TokenStore.ts     # JWT via safeStorage+electron-store; getDeviceId() persistent UUID
├── preload/
│   └── index.ts              # contextBridge → window.electronAPI (all channels)
└── renderer/src/
    ├── App.tsx               # HashRouter + QueryClientProvider + RequireAuth + all routes
    ├── api/
    │   ├── client.ts         # axios; baseURL from localStorage('serverUrl'); 401→/login
    │   ├── auth.ts           # authApi: login, logout, me, registerDevice
    │   ├── orders.ts         # ordersApi: list, create, get, addLines, removeLine,
    │   │                     #   sendKot, checkout, hold, unhold, cancel, transferTable
    │   ├── kots.ts           # kotsApi: list, get, updateStatus, updateLineStatus, reprint
    │   ├── items.ts          # itemsApi: list, get, create, update, delete, groups
    │   ├── units.ts          # unitsApi: list() → GET /units?per_page=500&status=active
    │   ├── itemVariants.ts   # itemVariantsApi: listByItem, get, create, update, delete
    │   ├── modifierGroups.ts # modifierGroupsApi: list, create, update, delete
    │   ├── media.ts          # mediaApi: upload, getByEntity, setPrimary, delete
    │   │                     #   ⚠️ is_primary must be sent as '1'/'0' NOT 'true'/'false'
    │   ├── combos.ts         # combosApi: list, get, create, update, delete
    │   ├── tables.ts         # tablesApi: getAll, getFloorPlans, updateStatus
    │   ├── inventory.ts      # inventoryApi: summary, stockItems, adjustments
    │   └── reports.ts        # reportsApi: salesSummary, itemWise, dayClose, gstSummary
    ├── bridge/ipc.ts         # typed wrappers for window.electronAPI
    ├── store/
    │   ├── authStore.ts      # user, token, isAuthenticated, serverUrl (persisted localStorage)
    │   ├── cartStore.ts      # lines, orderId, orderType, tableId, totals (renderer-only)
    │   └── syncStore.ts      # status: 'idle'|'syncing', lastSyncAt, errors
    └── pages/
        ├── auth/Login.tsx
        ├── setup/SetupWizard.tsx
        ├── pos/BillingScreen.tsx      # main POS: item grid + cart + keyboard shortcuts
        ├── pos/TableSelection.tsx     # floor plan tabs, color-coded table cards
        ├── kitchen/KitchenDisplay.tsx # dark Kanban (new/in_progress/ready), 10s refetch
        ├── orders/
        │   ├── OrderList.tsx          # tabs: Active / Paid Today / All
        │   ├── OrderDetail.tsx        # view order, Resume, Cancel, Reprint
        │   └── HoldOrders.tsx         # pos_held=true orders
        ├── inventory/
        │   ├── ItemList.tsx           # paginated item list, search, New Item button
        │   ├── ItemDetail.tsx         # create/edit item: name, unit, price, CGST/SGST, variants table, images
        │   ├── ModifierGroupManager.tsx
        │   ├── ComboManager.tsx
        │   └── StockSummary.tsx       # low-stock filter, search, color-coded rows
        ├── reports/
        │   ├── SalesSummary.tsx       # date presets, KPI cards, by_order_type, daily table
        │   ├── DayClose.tsx           # single date, cash drawer, top 10 items
        │   ├── ItemWise.tsx           # date range, search, totals footer
        │   └── GSTReport.tsx         # rate-slab breakup, CGST/SGST columns
        └── settings/
            ├── PrinterSettings.tsx   # detect printers, receipt+KOT printer, 58/80mm, test print
            ├── TableManager.tsx      # manage dining tables
            └── DeviceInfo.tsx        # serverUrl, deviceId, sync status, version
```

---

## IPC Channels

All registered in `src/main/ipc/ipcHandlers.ts`. Exposed via `src/preload/index.ts`.

```
auth:token:get            → TokenStore.getToken()
auth:token:set (token)    → TokenStore.setToken()
auth:token:clear          → TokenStore.clearToken()
auth:device-id            → TokenStore.getDeviceId()   (generates UUID once, persists)

settings:get (key)        → TokenStore.getSetting()
settings:set (key, val)   → TokenStore.setSetting()
settings:delete (key)     → TokenStore.deleteSetting()

items:search (q, groupId) → ItemRepository.search()    (SQLite FTS, LIMIT 80)
items:groups              → ItemRepository.getGroups()
items:get-all             → ItemRepository.getAllForPOS()  (LIMIT 500, used by POS grid)

units:get-all             → UnitRepository.getAll()     (active units only)

tables:get-all            → TableRepository.getAll()
tables:floor-plans        → TableRepository.getFloorPlans()

sync:trigger              → SyncEngine.runSync()
sync:status               → SyncEngine.getSyncStatus()
sync:status-changed       ← broadcast from SyncEngine to all windows (ipcMain.emit)

print:receipt (data)      → ThermalPrinter.printReceipt()
print:kot (data)          → KotPrinter.printKOT()
print:list-printers       → ThermalPrinter.listPrinters()

window:open-kitchen       → creates KitchenWindow (secondary display, fullscreen)
window:close-kitchen      → closes KitchenWindow

updater:install-now       → autoUpdater.quitAndInstall()
updater:update-available  ← broadcast from autoUpdater
updater:update-downloaded ← broadcast from autoUpdater
```

---

## Renderer Routes (`src/renderer/src/App.tsx`)

All use **HashRouter** (Electron file:// URLs).

```
/setup                    SetupWizard          public
/login                    Login                public
/kitchen                  KitchenDisplay       public (KitchenWindow)
/pos/billing              BillingScreen        RequireAuth  ← default after login
/pos/tables               TableSelection       RequireAuth
/pos/orders               OrderList            RequireAuth
/pos/orders/:id           OrderDetail          RequireAuth
/pos/hold                 HoldOrders           RequireAuth
/reports/sales            SalesSummary         RequireAuth
/reports/day-close        DayClose             RequireAuth
/reports/items            ItemWise             RequireAuth
/reports/gst              GSTReport            RequireAuth
/inventory/items          ItemList             RequireAuth
/inventory/items/:id      ItemDetail           RequireAuth  ← id='new' for create
/inventory/modifiers      ModifierGroupManager RequireAuth
/inventory/combos         ComboManager         RequireAuth
/inventory/stock          StockSummary         RequireAuth
/settings/device          DeviceInfo           RequireAuth
/settings/printer         PrinterSettings      RequireAuth
/settings/tables          TableManager         RequireAuth
*                         → /pos/billing (auth) or /login
```

`RequireAuth`: redirects `/setup` if no serverUrl, `/login` if not authenticated.

**⚠️ Route gotcha:** Never add a static `/inventory/items/new` route alongside `/inventory/items/:id`.
React Router matches the static route first and `useParams()` returns `{}` (id = undefined).
Use only `/inventory/items/:id` — `id === 'new'` detects the create case.

---

## Zustand Stores

### cartStore (`src/renderer/src/store/cartStore.ts`)
```typescript
// State
lines: CartLine[]           // kotStatus: 'pending'|'sent'|'cooking'|'ready'|'served'
orderId: string | null      // server order ID, or 'local-{timestamp}' before first KOT
orderType: 'takeaway'|'dine_in'|'delivery'
tableId: string | null
tableName: string | null
totals: { subtotal, cgstTotal, sgstTotal, netPayable, roundOff }

// Actions
addItem(item)               // increments qty if same pending item, else new line
updateQty(lineId, qty)      // only works if kotStatus='pending'
removeItem(lineId)          // only works if kotStatus='pending'
markLinesSent(lineIds)      // sets kotStatus='sent' (called after sendKot API success)
setOrder(id, type, tableId?, tableName?)
clearOrder()                // full reset including lines
clearCart()                 // clears lines only, keeps orderId
```

`totals` is computed on every state change via `computeTotals()` — calls `calcGST()` per line.

### authStore (`src/renderer/src/store/authStore.ts`)
Persists: `user`, `token`, `isAuthenticated`, `serverUrl` to localStorage.
`logout()` clears localStorage and redirects to `/login`.

### syncStore (`src/renderer/src/store/syncStore.ts`)
Updated by IPC `sync:status-changed` broadcast from main process.

---

## GST Calculation (`src/renderer/src/lib/utils.ts`)

```typescript
function calcGST(taxable: number, rate: number, isInterState: boolean) {
  const total = taxable * (rate / 100)
  return isInterState
    ? { igst: total, cgst: 0, sgst: 0 }
    : { igst: 0, cgst: total / 2, sgst: total / 2 }
}
function calcRoundOff(amount: number) {
  const rounded = Math.round(amount)
  return { netPayable: rounded, roundOff: +(rounded - amount).toFixed(2) }
}
```

---

## Sync Architecture

**SyncScheduler** (`src/main/sync/SyncScheduler.ts`):
- 30-minute `setInterval` — `const SYNC_INTERVAL = 30 * 60 * 1000`
- Re-syncs immediately when network comes back online (`net.on('online', ...)`)
- Immediate trigger also available via `sync:trigger` IPC → `triggerNow()`

**SyncEngine** (`src/main/sync/SyncEngine.ts`):
- `isSyncing` boolean is set **synchronously** before any async work — prevents overlap
- Spawns `SyncWorker.js` as a `worker_threads` Worker so main thread is never blocked
- `finished` flag inside the Promise prevents double-resolve if both `message` and `exit` fire
- Always releases `isSyncing` in the `exit` handler regardless of exit code
- Broadcasts `sync:status-changed` to all BrowserWindows on start, success, and error
- Returns `SyncResult { pushed, pulled, errors, lastSyncAt }`

**SyncWorker** (`src/main/sync/SyncWorker.ts`):
- Runs in its own worker thread — opens its own `better-sqlite3` connection
- Receives `{ dbPath, token, serverUrl }` via `workerData`
- Uses `db.transaction()` for every batch upsert (atomic, avoids lock contention)
- Sets `busy_timeout = 5000` so concurrent reads from main thread don't cause SQLITE_BUSY
- **PUSH** — `sales_invoices` where `sync_status='pending'` (LIMIT 50); marks `'synced'` or `'failed'`
- **PULL** — in order: `units`, `item_groups`, `items` (paginated), `media` (paginated), `floor_plans`, `dining_tables`, `godowns`
- Posts `{ pushed, pulled, errors }` via `parentPort.postMessage()` then exits

**electron-vite config** — SyncWorker is a second rollup entry point:
```typescript
build: { rollupOptions: { input: {
  index: resolve('src/main/index.ts'),
  SyncWorker: resolve('src/main/sync/SyncWorker.ts'),
}}}
```
The compiled output is at `out/main/SyncWorker.js` — SyncEngine references it via `join(__dirname, 'SyncWorker.js')`.

### ⚠️ Media Sync Gotcha

`GET /media` (`MediaController@index`) requires **both** `entity_type` AND `entity_id` (UUID).
Calling it without `entity_id` returns **422**.

The SyncWorker uses the bulk sync endpoint instead:
```
GET /media/sync?entity_type=item&per_page=200&page=N
```
This endpoint (`MediaController@sync`) requires only `entity_type` and returns paginated results
with `next_page_url` for the cursor loop — no `entity_id` needed.

Do NOT change `SyncWorker.ts` to call `/media` — it will 422 every time.

---

## Kitchen Window (`src/main/index.ts`)

```typescript
function createKitchenWindow() {
  const displays = screen.getAllDisplays()
  const secondary = displays.find(d => d.id !== primaryDisplay.id) ?? displays[0]
  kitchenWindow = new BrowserWindow({
    x: secondary.bounds.x, y: secondary.bounds.y,
    width: secondary.bounds.width, height: secondary.bounds.height,
    fullscreen: displays.length > 1,
    // ...
  })
  kitchenWindow.loadURL(mainWindowUrl + '#/kitchen')
}
```

---

## Thermal Printing (`src/main/print/`)

`ThermalPrinter.ts`:
- `printReceipt(data)` — reads `printerName` + `paperWidth` from TokenStore
- `buildPrinter(name)` — `new ThermalPrinter({ type: PrinterTypes.EPSON, interface: 'printer:${name}' })`
- Paper width: '58' → 32 chars/line, '80' → 48 chars/line

`KotPrinter.ts`:
- `printKOT(data)` — reads `kotPrinterName`, falls back to `printerName`

Printer name, KOT printer name, paper width stored via `settings:set` IPC (TokenStore key-value).

---

## Auto-Updater (`src/main/index.ts`)

```typescript
function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
  autoUpdater.on('update-downloaded', () =>
    BrowserWindow.getAllWindows().forEach(w =>
      w.webContents.send('updater:update-downloaded')))
}
```

Renderer shows banner → "Restart & Update" → `ipc.updater.installNow()` → `autoUpdater.quitAndInstall()`.

---

## electron-builder.yml

```yaml
appId: com.zazzy.pos
asar: true
asarUnpack:
  - node_modules/better-sqlite3/**/*      # native .node binary
  - node_modules/node-thermal-printer/**/*
mac:
  target: [dmg]
  arch: [x64, arm64]
win:
  target: [nsis]
linux:
  target: [AppImage]
```

`asarUnpack` is required for native modules — they can't run from inside the asar archive.

---

## PaymentModal Split Payment

`src/renderer/src/components/pos/PaymentModal.tsx`:
- Single mode: cash / upi / card / credit
- Split: toggle → per-row `{mode, amount}` + cash tendered row; "Autofill remaining" button
- Validates: sum of split amounts must equal `netPayable`
- Sends to API: `{ payment_mode: 'split', split_payments: [{mode, amount}, ...] }`
- Quick cash buttons: ₹100, ₹200, ₹500, ₹1000, "Exact"

---

## BillingScreen Keyboard Shortcuts

```
F1    → /pos/tables
F2    → focus item search (handled inside ItemGrid)
F3    → handleSendKot() (dine_in only)
F4    → open PaymentModal
F5    → handleSyncNow()
Esc   → close modal/drawer
```

---

## POS Item Grid (`src/renderer/src/components/pos/ItemGrid.tsx`)

- Loads **all active items (max 500)** from SQLite once on mount via `items:get-all` IPC
- `useQuery` with `staleTime: 30_000` — re-fetches every 30s aligned with sync interval
- **All filtering is client-side** using `useMemo` — no IPC calls on search/group change
- Category group filter: `item.item_group_id === selectedGroup`
- Text filter: `item.name` + `item.sku` case-insensitive includes
- Each card shows: name, price (₹), unit, GST rate

---

## Inventory Management (`src/renderer/src/pages/inventory/ItemDetail.tsx`)

### Item form fields
- Name (full-width), Unit (dropdown from API), Selling Price, CGST %, SGST %
- **CGST and SGST default to 2.5%** (5% GST slab, most common for restaurant)
- SKU field is intentionally omitted from the POS item form
- `is_active` checkbox

### Unit dropdown
- Fetched live from `GET /units?per_page=500&status=active` via `unitsApi.list()`
- Falls back to hardcoded PCS/KG/L/BOX/STRIP if API returns empty
- Unit model fields: `id`, `value` (e.g. "PCS"), `label` (e.g. "Pieces"), `status`

### Variants table (bulk save)
- Inline editable table: Variant Name | Price (₹) | ✕ per row
- `+ Add Row` adds a blank local row — no API call
- `✕` removes row locally — no API call
- **Save Variants** fires one `Promise.all` that:
  - Rows without `id` → `itemVariantsApi.create()`
  - Rows with `id` → `itemVariantsApi.update()`
  - Server variants whose `id` is missing from table → `itemVariantsApi.delete()`
- Variants section only shown after item is saved (not on `isNew`)

---

## Media Upload Gotcha

Laravel validates `is_primary` as a boolean. **multipart/form-data must send `'1'` or `'0'`**, not `'true'`/`'false'`.

```typescript
// ✅ correct
formData.append('is_primary', isPrimary ? '1' : '0')

// ❌ wrong — Laravel rejects "false" string
formData.append('is_primary', String(isPrimary))
```

---

## Adding a New IPC Channel (checklist)

When exposing a new SQLite query to the renderer, touch **4 files** in order:

1. `src/main/db/repositories/<Repo>.ts` — add the query method
2. `src/main/ipc/ipcHandlers.ts` — `ipcMain.handle('channel:name', () => Repo.method())`
3. `src/preload/index.ts` — add to `contextBridge.exposeInMainWorld` object
4. `src/renderer/src/bridge/ipc.ts` — add type declaration in `Window` interface + wrapper in `ipc` export
