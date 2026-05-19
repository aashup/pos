# Zazzy POS — Electron App

Restaurant point-of-sale desktop application built with Electron 32, React 19, Vite, and TypeScript. Backed by a Laravel API with a local SQLite database for offline-first operation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 32.3.3 |
| UI framework | React 19 + TypeScript |
| Build tool | electron-vite + Vite 5 |
| Styling | Tailwind CSS 4 |
| Local database | better-sqlite3 v11+ |
| State management | Zustand 5 |
| Data fetching | TanStack React Query 5 |
| HTTP client | Axios |
| Routing | React Router 7 (HashRouter) |
| Settings storage | electron-store v8 |
| Printing | node-thermal-printer |

## Prerequisites

- Node.js 18+
- The Laravel API running locally (see root `README` / `make start`)
- Windows build tools (for native module compilation)

## Getting Started

```bash
cd electron-app
npm install          # also runs electron-rebuild for better-sqlite3
npm run dev          # starts main + renderer with HMR
```

Build a distributable:

```bash
npm run build        # outputs to out/
```

## Project Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts             # app entry: window, IPC, SyncScheduler, autoUpdater
│   ├── ipc/ipcHandlers.ts   # all IPC channel registrations
│   ├── db/
│   │   ├── database.ts      # better-sqlite3 singleton
│   │   ├── schema.sql       # CREATE TABLE IF NOT EXISTS (runs every startup)
│   │   └── repositories/    # ItemRepository, OrderRepository, KotRepository, …
│   ├── sync/
│   │   ├── SyncEngine.ts    # orchestrates push + pull, broadcasts sync:status-changed
│   │   ├── SyncScheduler.ts # 30-min interval + re-sync on network online
│   │   └── SyncWorker.ts    # worker_threads: push pending invoices, pull reference data
│   ├── print/
│   │   ├── ThermalPrinter.ts
│   │   └── KotPrinter.ts
│   └── auth/TokenStore.ts   # JWT via safeStorage + electron-store; device UUID
├── preload/index.ts         # contextBridge → window.electronAPI
└── renderer/src/
    ├── App.tsx              # HashRouter + routes
    ├── api/                 # Axios API clients (used by inventory/settings pages)
    ├── bridge/ipc.ts        # typed wrappers for window.electronAPI
    ├── store/               # Zustand stores (auth, cart, sync, tables, orders, kots, theme)
    └── pages/
        ├── auth/
        ├── pos/             # BillingScreen, TableSelection
        ├── kitchen/         # KitchenDisplay (secondary monitor)
        ├── orders/          # OrderList, OrderDetail, HoldOrders
        ├── inventory/       # ItemList, ItemDetail, ModifierGroupManager, ComboManager
        ├── reports/         # SalesSummary, DayClose, ItemWise, GSTReport
        └── settings/        # PrinterSettings, TableManager, DeviceInfo
```

## Key Architecture Decisions

- **Offline-first** — all core POS actions write to local SQLite immediately via IPC; server sync is fire-and-forget in the background.
- **No IndexedDB** — all local data goes through IPC to `better-sqlite3` in the main process.
- **Cart state is Zustand only** — SQLite is written only on KOT send / hold / payment.
- **HashRouter** — required because Electron loads `file://` URLs; history router does not work.
- **SyncWorker runs in a worker thread** — keeps the main thread unblocked during sync.

## Critical Version Constraints

| Package | Required | Reason |
|---------|----------|--------|
| `better-sqlite3` | **v11+** | v9 breaks with Electron 32 (C++20 / V8 API mismatch) |
| `electron-store` | **v8** | v10 is ESM-only — CJS main process cannot `require()` it |
| `electron` | **32.3.3** | ABI target for native modules |

After changing `better-sqlite3` version always rebuild: `npx electron-rebuild -f -w better-sqlite3`.

## Sync

- **Interval:** every 30 minutes, or immediately when the network comes back online.
- **Manual trigger:** `ipc.sync.trigger()` from any renderer page (or press **F5** on BillingScreen).
- **PUSH:** pending `sales_invoices` and `pos_customers` (sync_status = `'pending'`).
- **PULL:** units, item groups, items, variants, modifier groups, combos, media, floor plans, dining tables, godowns, orders.

## Keyboard Shortcuts (BillingScreen)

| Key | Action |
|-----|--------|
| F1 | Table selection |
| F2 | Focus item search |
| F3 | Send KOT (dine-in) |
| F4 | Open payment modal |
| F5 | Trigger manual sync |
| Esc | Close modal / drawer |

## Printing

Thermal receipt and KOT printing via `node-thermal-printer`. Configure printer name and paper width (58 mm / 80 mm) in **Settings → Printer**. A secondary KOT printer can be set independently.

## Building for Distribution

```bash
npm run build
```

Output is in `out/`. The `electron-builder.yml` at the project root packages it as:

- **Windows:** NSIS installer
- **macOS:** DMG (x64 + arm64)
- **Linux:** AppImage

`better-sqlite3` and `node-thermal-printer` are unpacked from the asar archive automatically (required for native `.node` binaries).

## Environment / API

The app expects a running Zazzy POS Laravel API. On first launch, the setup wizard prompts for the server URL (e.g. `http://192.168.1.10:8000`). This URL is persisted in localStorage and used by the Axios client for all API calls.
