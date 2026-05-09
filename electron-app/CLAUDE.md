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
│   │   └── schema.sql        # CREATE TABLE IF NOT EXISTS (idempotent, runs every startup)
│   ├── sync/
│   │   ├── SyncEngine.ts     # orchestrates push+pull, broadcasts sync:status-changed
│   │   ├── SyncScheduler.ts  # 30s foreground / 300s background setInterval
│   │   ├── PullWorker.ts     # pulls item_groups, items, floor_plans, dining_tables
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
    │   ├── orders.ts         # ordersApi: list, create, get, addLines, removeLine,
    │   │                     #   sendKot, checkout, hold, unhold, cancel, transferTable
    │   ├── kots.ts           # kotsApi: list, get, updateStatus, updateLineStatus, reprint
    │   ├── items.ts          # itemsApi: search, getGroups
    │   ├── tables.ts         # tablesApi: getAll, getFloorPlans, updateStatus
    │   ├── inventory.ts      # inventoryApi: summary, stockItems, adjustments
    │   ├── reports.ts        # reportsApi: salesSummary, itemWise, dayClose, gstSummary
    │   └── auth.ts           # authApi: login, logout, me, registerDevice
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
        ├── inventory/StockSummary.tsx # low-stock filter, search, color-coded rows
        ├── reports/
        │   ├── SalesSummary.tsx       # date presets, KPI cards, by_order_type, daily table
        │   ├── DayClose.tsx           # single date, cash drawer, top 10 items
        │   ├── ItemWise.tsx           # date range, search, totals footer
        │   └── GSTReport.tsx         # rate-slab breakup, CGST/SGST columns
        └── settings/
            ├── PrinterSettings.tsx   # detect printers, receipt+KOT printer, 58/80mm, test print
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

items:search (q, groupId) → ItemRepository.search()    (SQLite FTS)
items:groups              → ItemRepository.getGroups()

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
/setup              SetupWizard        public
/login              Login              public
/kitchen            KitchenDisplay     public (KitchenWindow)
/pos/billing        BillingScreen      RequireAuth  ← default after login
/pos/tables         TableSelection     RequireAuth
/pos/orders         OrderList          RequireAuth
/pos/orders/:id     OrderDetail        RequireAuth
/pos/hold           HoldOrders         RequireAuth
/reports/sales      SalesSummary       RequireAuth
/reports/day-close  DayClose           RequireAuth
/reports/items      ItemWise           RequireAuth
/reports/gst        GSTReport          RequireAuth
/inventory/stock    StockSummary       RequireAuth
/settings/device    DeviceInfo         RequireAuth
/settings/printer   PrinterSettings    RequireAuth
*                   → /pos/billing (auth) or /login
```

`RequireAuth`: redirects `/setup` if no serverUrl, `/login` if not authenticated.

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
- 30s interval when app is focused
- 300s interval when app is in background
- Immediate trigger via `sync:trigger` IPC

**PullWorker** — pulls DOWN (upsert via INSERT OR REPLACE):
- `item_groups` (500/page), `items` (200/page, paginated), `floor_plans`, `dining_tables`, `godowns`

**PushWorker** — pushes UP:
- `sales_invoices` + `sales_invoice_lines` where `sync_status='pending'`
- Sets `sync_status='synced'` on success

**SyncEngine.runSync()**:
1. Guard with `isSyncing` flag (no concurrent syncs)
2. `PushWorker.push()`
3. `PullWorker.pull()`
4. Broadcast `sync:status-changed` to all BrowserWindows

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
F3    → handleSendKot() (dine_in only)
F4    → open PaymentModal
F5    → handleSyncNow()
Esc   → close modal/drawer
```
