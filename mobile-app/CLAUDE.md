# Zazzy Mobile — React Native POS

Waitstaff mobile POS for tableside ordering. Expo SDK 54 + Development Build. Connects to the same Laravel backend as the Zazzy POS desktop app.

## Directory Layout

```
mobile-app/
├── app/                    # Expo Router (file-based routing)
│   ├── _layout.tsx         # Root: QueryClientProvider + DatabaseProvider + Toast
│   ├── index.tsx           # Redirect → tables or login based on auth
│   ├── (auth)/             # Unauthenticated routes
│   │   └── login.tsx
│   └── (tabs)/             # Authenticated tab screens
│       ├── tables.tsx      # Floor plan tabs + table grid + QR scan
│       ├── billing.tsx     # Item grid + cart sidebar + barcode scan
│       ├── orders.tsx      # Order history list
│       └── settings.tsx    # Server URL, logout, force sync
├── src/
│   ├── api/                # Axios API functions (NOT React hooks)
│   │   ├── client.ts       # Axios instance; reads token + serverUrl from MMKV via getAuthStore()
│   │   ├── auth.ts         # login()
│   │   ├── items.ts        # fetchItems(), fetchItemGroups()
│   │   ├── tables.ts       # fetchFloorPlans(), fetchDiningTables()
│   │   └── orders.ts       # createOrder(), addOrderLines(), sendKot(), checkoutOrder(), ...
│   ├── db/
│   │   ├── index.ts        # WatermelonDB singleton (database)
│   │   ├── schema.ts       # All 7 table schemas
│   │   └── models/         # 7 WatermelonDB model classes
│   ├── hooks/              # TanStack Query hooks that write to WatermelonDB
│   │   ├── useItemsSync.ts
│   │   ├── useTablesSync.ts
│   │   └── useOrdersSync.ts
│   ├── store/
│   │   ├── authStore.ts    # Zustand + MMKV persistence; exports getAuthStore() for axios
│   │   └── cartStore.ts    # Zustand cart (in-memory; written to DB only on KOT/checkout)
│   ├── lib/
│   │   ├── orderActions.ts # sendKot(), checkout(), holdOrder() — write-local-then-sync-async
│   │   ├── locationService.ts  # Background geolocation start/stop
│   │   ├── queryClient.ts  # TanStack QueryClient singleton
│   │   └── utils.ts        # cn(), haversineDistance(), formatCurrency()
│   └── components/
│       ├── pos/            # TableCard, ItemCard
│       └── scanner/        # BarcodeScanner (VisionCamera useCodeScanner)
├── app.config.js           # Expo config (newArchEnabled: false, plugins, permissions)
├── babel.config.js         # Decorators + NativeWind babel plugin
├── metro.config.js         # withNativeWind() wrapper
└── tailwind.config.js      # nativewind/preset
```

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

## Critical Architecture Decisions

### `newArchEnabled: false` in app.config.js — DO NOT CHANGE
WatermelonDB JSI is incompatible with React Native 0.81's New Architecture. Changing this will break the database.

### Two-layer data separation
- **Write path**: TanStack Query fetches from API → upserts into WatermelonDB
- **Read path**: UI components use WatermelonDB `withObservables` / `observe()` — never read from TanStack Query cache in UI
- TanStack Query is for sync orchestration only, not as a UI data source

### Cart state is Zustand only
Cart lines live in Zustand (in-memory). WatermelonDB is written only when:
- KOT is sent (`sendKot()`)
- Order is checked out (`checkout()`)
- Order is held (`holdOrder()`)

### Write-local-then-sync-async pattern
All order mutations write to WatermelonDB first, then fire-and-forget to server. Never block UI on network. See `src/lib/orderActions.ts`.

### Never overwrite pending local orders on pull sync
`useOrdersSync` skips server rows when local `sync_status === 'pending'`. Mirror of the desktop `SyncWorker.ts` pattern.

### Location logs are device-local only
`location_logs` table has a `synced` column that is always `false`. There is no backend endpoint for location data. Never attempt to sync it.

## Critical Version Constraints — DO NOT CHANGE

| Package | Version | Why |
|---------|---------|-----|
| `nativewind` | ^4.2.3 | v4 uses `withNativeWind()` metro wrapper — v2/v3 pattern silently breaks |
| `tailwindcss` | ^3.4.x | NativeWind v4 requires Tailwind v3, NOT v4 |
| `react-native-vision-camera` | ^5.x | Use built-in `useCodeScanner` hook — do NOT add `vision-camera-code-scanner` (that's v2/v3) |
| `@babel/plugin-proposal-decorators` | `{ legacy: true }` | Required for WatermelonDB `@field()` decorators |
| `newArchEnabled` | `false` | WatermelonDB JSI compatibility |

## WatermelonDB Models

All models use `@field()` decorators and live in `src/db/models/`.

| Model | Table | Key fields |
|-------|-------|-----------|
| `ItemGroup` | `item_groups` | `serverId`, `name` |
| `Item` | `items` | `serverId`, `name`, `price`, `barcode` (nullable), `itemGroupId`, `isActive` |
| `FloorPlan` | `floor_plans` | `serverId`, `name` |
| `DiningTable` | `dining_tables` | `serverId`, `floorPlanId`, `name`, `status`, `currentOrderId` |
| `Order` | `orders` | `serverId` (nullable), `tableId`, `status`, `syncStatus`, `totalAmount` |
| `OrderLine` | `order_lines` | `orderId`, `itemId`, `itemName`, `quantity`, `price`, `sent` |
| `LocationLog` | `location_logs` | `latitude`, `longitude`, `accuracy`, `recordedAt`, `synced` (always false) |

To update schema: bump `version` in `src/db/schema.ts` and add a migration in `src/db/migrations.ts` (create this file when needed). Wipe and reinstall the app to apply schema changes during development.

## Backend API

Same Laravel backend as the desktop app. All under `/api/v1/` with `Authorization: Bearer <token>`.

| Endpoint | Used for |
|----------|---------|
| `POST /login` | Auth |
| `GET /floor-plans` | Floor plan + table sync |
| `GET /dining-tables?is_active=1` | Table sync fallback |
| `GET /items?per_page=200&page=N` | Item sync (paginated) |
| `GET /item-groups` | Category sync |
| `POST /restaurant/orders` | Create order |
| `POST /restaurant/orders/{id}/lines` | Add order lines |
| `POST /restaurant/orders/{id}/kot` | Send to kitchen |
| `POST /restaurant/orders/{id}/checkout` | Payment |
| `POST /restaurant/orders/{id}/hold` | Hold order |
| `POST /restaurant/orders/{id}/cancel` | Cancel order |

The server URL is configured at runtime in Settings and stored in MMKV. Default: `http://192.168.1.1:8000`.

## Background Geolocation

Requires a paid license from [Transistor Software](https://transistorsoft.com). Add key to `.env`:
```
BACKGROUND_GEOLOCATION_LICENSE=your_key_here
```

Config: `distanceFilter: 50` (native 50 m guard) + JS haversine check as secondary guard. `heartbeatInterval: 600` (10 min on iOS). Android foreground service enabled.

## Barcode / QR Scanning

- **Table QR codes** encode the table's `server_id` (backend UUID) → look up by `Q.where('server_id', value)`
- **Item barcodes** look up by `Q.where('barcode', value)` in WatermelonDB items
- Must be tested on a physical device — emulator cameras are unreliable for barcode detection

## NativeWind Setup (v4)

Three parts that must all be present:
1. `metro.config.js` — `withNativeWind(config, { input: './global.css' })`
2. `babel.config.js` — `jsxImportSource: 'nativewind'` in preset + `'nativewind/babel'` plugin
3. `tailwind.config.js` — `require('nativewind/preset')` in presets

If styles silently don't apply, check all three files.
