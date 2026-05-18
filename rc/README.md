# Zazzy POS — React Native (Android)

A fully offline-capable restaurant point-of-sale application built with React Native 0.75 and WatermelonDB. Works without internet — all data is stored locally first and synced to the Laravel API in the background.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Running the App](#running-the-app)
- [Environment / API Config](#environment--api-config)
- [Printer Support](#printer-support)
- [Sync Engine](#sync-engine)
- [Troubleshooting](#troubleshooting)

---

## Overview

Zazzy POS (`rc/`) is the Android client for the Zazzy POS restaurant management system. It shares the same Laravel API backend as the Electron desktop app (`electron-app/`) and the Expo mobile app (`mobile-app/`).

| App | Platform | Path |
|-----|----------|------|
| `rc/` | Android (React Native 0.75) | `D:\erp\pos\rc` |
| `electron-app/` | Windows desktop (Electron 32) | `D:\erp\pos\electron-app` |
| `mobile-app/` | Android / iOS (Expo SDK 54) | `D:\erp\pos\mobile-app` |
| `api/` | Laravel + MySQL (Docker) | `D:\erp\pos\api` |

---

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | React Native | 0.75.5 |
| Language | TypeScript | 5.0.4 |
| Local database | WatermelonDB | 0.28.0 |
| State management | Zustand | 5.0.13 |
| Navigation | React Navigation (native-stack + bottom-tabs) | 6.x |
| HTTP client | Axios | 1.x |
| Persistence | AsyncStorage | 1.24 |
| Observables | @nozbe/with-observables | 1.6 |
| Thermal printing | react-native-thermal-receipt-printer-image-qr | 0.1.12 |
| System printing | react-native-print | 0.11.0 |
| IDs | uuid v4 | 11.x |

---

## Features

### POS Billing
- Floor-plan tabs with table grid — color-coded vacancy status (vacant / occupied / reserved / cleaning)
- Item grid with group filtering and search
- Cart with line-level quantity controls, chef notes, and variant/modifier selection
- GST calculation (CGST + SGST) with round-off
- Payment modal — single mode (Cash / UPI / Card / Credit) or split payment
- Quick cash buttons; auto-calculates change

### Kitchen Order Tickets (KOT)
- Send KOT writes order lines to local SQLite and pushes to server in the background
- Kitchen kanban board — three columns: **New → In Progress → Ready**
- Tap any KOT card to advance its status; server is updated asynchronously
- Reprint KOT directly from the kitchen board

### Orders
- Active, Held, and All orders tabs (reactive, WatermelonDB-driven)
- Order detail screen — line items, totals, payment info
- Resume a held order back into the cart
- Cancel order with server sync
- Reprint receipt from the order detail screen

### Sync Engine
- Full pull sync on login and on-demand: units, item groups, items, item variants, modifier groups, modifiers, combos, floor plans, dining tables, orders, KOTs
- Offline-first: every write goes to local SQLite first; server push is fire-and-forget with retry pending
- Sync status bar shows last sync time; tap to trigger manual sync

### Printer Support (4 modes)
| Mode | Description |
|------|-------------|
| **Bluetooth** | Paired ESC/POS thermal printer via BLE |
| **Network** | ESC/POS printer on TCP port 9100 (Wi-Fi / LAN) |
| **USB** | ESC/POS printer via USB OTG cable |
| **System** | Android print dialog — any Mopria printer, Google Drive PDF, or save locally |

- Network tab includes a subnet scanner that probes `.1–.254` on port 9100 and lists found printers
- Auto-print KOT and/or receipt on each action
- Paper width selector: 58 mm or 80 mm
- Test print button

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI (TSX)                     │
│   Screens → withObservables HOC → WatermelonDB observers     │
└─────────────────────┬───────────────────────────────────────┘
                      │ reads / writes
┌─────────────────────▼───────────────────────────────────────┐
│               WatermelonDB (SQLite)                          │
│   12 tables: items, orders, order_lines, kots, …            │
└─────────────────────┬───────────────────────────────────────┘
                      │ background push / pull
┌─────────────────────▼───────────────────────────────────────┐
│               Laravel API  (api/)                            │
│   REST + Sanctum auth — http://10.0.2.2:8000/api/v1/        │
└─────────────────────────────────────────────────────────────┘
```

**Key rules:**
- **All UI reads come from WatermelonDB**, never from API responses directly
- **Cart state is Zustand-only** — SQLite is written only when KOT is sent, order is held, or payment is confirmed
- **All server calls are fire-and-forget** — local write first, then async API push in `setTimeout(0)`
- **`withObservables`** wraps every list screen so the UI reacts to DB changes without manual re-fetching

---

## Database Schema

Schema version: **2** — 12 tables

| Table | Purpose |
|-------|---------|
| `items` | Menu items with price, GST rates, variant/modifier flags |
| `item_groups` | Category groupings for items |
| `item_variants` | Size/variant options per item |
| `modifier_groups` | Add-on groups (e.g. "Toppings") |
| `modifiers` | Individual add-ons within a group |
| `units` | Units of measurement (pcs, kg, litre, …) |
| `combos` | Combo meal definitions |
| `floor_plans` | Restaurant floor layout groupings |
| `dining_tables` | Individual tables with status |
| `orders` | Restaurant orders (open / held / confirmed / cancelled) |
| `order_lines` | Line items belonging to an order |
| `kots` | Kitchen order tickets linking lines to kitchen |

All tables include `server_id` (nullable until synced) and `sync_state` (`pending` / `synced`).

---

## Project Structure

```
rc/
├── android/                   # Android native project (Gradle)
├── src/
│   ├── api/                   # Axios API wrappers
│   │   ├── auth.ts            # Login / logout / me
│   │   ├── client.ts          # Axios instance with baseURL + token interceptor
│   │   ├── items.ts           # Items CRUD
│   │   ├── orders.ts          # Orders + KOT endpoints
│   │   ├── kots.ts            # KOT status updates
│   │   ├── tables.ts          # Floor plans + dining tables
│   │   ├── units.ts           # Units list
│   │   ├── itemGroups.ts      # Item groups list
│   │   ├── itemVariants.ts    # Item variants list
│   │   ├── modifierGroups.ts  # Modifier groups + modifiers
│   │   └── combos.ts          # Combos list
│   │
│   ├── components/
│   │   ├── kitchen/
│   │   │   └── KotCard.tsx    # Kanban KOT card with advance + reprint
│   │   └── pos/
│   │       ├── Cart.tsx               # Right-pane cart (lines, totals, actions)
│   │       ├── ItemCard.tsx           # Item grid card
│   │       ├── TableCard.tsx          # Table grid card
│   │       ├── PaymentModal.tsx       # Payment flow (single + split)
│   │       └── VariantModifierModal.tsx  # Variant/modifier selection
│   │
│   ├── db/
│   │   ├── index.ts           # WatermelonDB instance + collection exports
│   │   ├── schema.ts          # Table schemas (v2)
│   │   ├── migrations.ts      # Schema migration stubs
│   │   └── models/            # WatermelonDB Model classes (one per table)
│   │
│   ├── lib/
│   │   ├── orderActions.ts    # startOrder, sendKot, holdOrder, checkoutOrder, …
│   │   ├── printer.ts         # ESC/POS + HTML print builders; connectAndPrint
│   │   ├── syncEngine.ts      # pullAll() + pushPendingOrders()
│   │   └── utils.ts           # calcGST, calcRoundOff, formatCurrency
│   │
│   ├── mocks/
│   │   └── react-native-ping.js  # Stub — prevents Android 14 crash
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx  # Root stack (Login, tabs, OrderDetail, PrinterSettings)
│   │   ├── TabNavigator.tsx   # Bottom tabs (Tables, Billing, Kitchen, Orders, Settings)
│   │   └── types.ts           # RootStackParamList type definitions
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx
│   │   ├── order/
│   │   │   └── OrderDetailScreen.tsx
│   │   ├── settings/
│   │   │   └── PrinterScreen.tsx
│   │   └── tabs/
│   │       ├── TablesScreen.tsx   # Floor-plan tabs + table grid
│   │       ├── BillingScreen.tsx  # Item grid + cart split-view
│   │       ├── KitchenScreen.tsx  # Kanban board (new / in_progress / ready)
│   │       ├── OrdersScreen.tsx   # Active / Held / All order list
│   │       └── SettingsScreen.tsx
│   │
│   └── store/
│       ├── authStore.ts       # Zustand — token, user, serverUrl
│       ├── cartStore.ts       # Zustand — cart lines, totals, localOrderId
│       ├── printerStore.ts    # Zustand (AsyncStorage) — printer config
│       └── syncStore.ts       # Zustand — lastSyncAt, syncing, error
│
├── App.tsx                    # Root component — initialises stores
├── metro.config.js            # Metro config (react-native-ping stub)
├── tsconfig.json              # TypeScript config (@/ path alias → project root)
└── package.json
```

---

## Prerequisites

### Android

| Tool | Requirement |
|------|-------------|
| Node.js | ≥ 18 |
| Java (JDK) | Android Studio bundled JBR at `C:\Program Files\Android\Android Studio\jbr` |
| Android SDK | API 34+ (Android 14), build-tools 34 |
| ADB | In PATH (comes with Android Studio) |
| Laravel API | Running on `http://localhost:8000` (via Docker) |

> **Windows note:** `npm run android` does not work reliably on Windows. Use the manual Gradle commands shown below.

### Windows desktop (React Native Windows)

| Tool | Requirement |
|------|-------------|
| Node.js | ≥ 18 |
| Visual Studio | 2022 (17.x) or 2026 (18.x) with **Desktop development with C++** and **Universal Windows Platform development** workloads |
| Windows SDK | `10.0.26100.0` (installed) — or any SDK ≥ `10.0.22621.0` |
| Laravel API | Running on `http://localhost:8000` (via Docker) |

---

## Development Setup

### 1. Install dependencies

```powershell
cd D:\erp\pos\rc
npm install
```

### 2. Start the Laravel API

```powershell
cd D:\erp\pos
make start        # docker compose up
make install      # composer install (first time only)
make migrate-fresh-seed
```

The API will be at `http://localhost:8000`. The Android device/emulator reaches it at `http://10.0.2.2:8000` (emulator) or via your machine's LAN IP (physical device).

### 3. Connect your Android device

Enable **USB Debugging** on the device (Developer Options) and connect via USB. Verify with:

```powershell
adb devices
# Should show your device as "device"
```

---

## Running the App

> Run **both steps each session** — Metro tunnel resets on disconnect.

### Step 1 — Start Metro (keep this terminal open)

```powershell
cd D:\erp\pos\rc
npx react-native start
```

### Step 2 — Build and install (new terminal)

```powershell
# Required every session on Windows
adb reverse tcp:8081 tcp:8081

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd D:\erp\pos\rc\android
.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
```

The app launches automatically after install and connects to Metro.

### Hot reload

After installing, JS changes are reflected immediately via Metro's hot reload — **no Gradle rebuild needed** unless you:
- Add a new native module (npm install a package with native code)
- Modify `android/` files
- Change `metro.config.js`

### Reload the JS bundle manually

On the device, shake it or press `Ctrl+M` (over ADB) to open the Dev Menu → **Reload**.

---

## Running on Windows (Desktop)

The app runs as a native UWP application via React Native Windows 0.75.

### One command (Metro + build + deploy all in one)

```powershell
$env:MinimumVisualStudioVersion = "18.0.0"
cd D:\erp\pos\rc
npx react-native run-windows --msbuildprops "WindowsTargetPlatformVersion=10.0.26100.0"
```

> **First run takes 10–15 minutes** — the entire RNW C++ framework is compiled from source.
> Subsequent runs take ~1 minute because the build output is cached.

### Why these flags?

| Flag | Why it's needed |
|------|----------------|
| `$env:MinimumVisualStudioVersion = "18.0.0"` | RNW CLI defaults to looking for VS 19.x; this tells it to accept VS 2026 (18.x) |
| `--msbuildprops "WindowsTargetPlatformVersion=10.0.26100.0"` | RNW project files default to SDK `10.0.22621.0`; only `10.0.26100.0` is installed locally |

### VS 2026 compatibility patches (already applied, one-time)

RNW 0.75 was written for VS 2022. Three changes were made to make it compile with VS 2026:

| File | Change | Reason |
|------|--------|--------|
| `windows/ExperimentalFeatures.props` | Added `_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS` preprocessor define | VS 2026 STL treats `<experimental/coroutine>` as a hard error |
| `Directory.Build.props` *(project root)* | Added `/Wv:17` compiler flag + `_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS` | Caps MSVC 14.51 warning version to VS 2022 level; suppresses new warnings-as-errors in all `node_modules\*\windows\` packages |
| `node_modules\react-native-windows\Directory.Build.props` | Same `/Wv:17` + preprocessor define | Applies to all RNW core C++ projects |
| `node_modules\react-native-print\windows\RNPrint\RNPrint.vcxproj` | `WindowsTargetPlatformMinVersion` bumped from `10.0.16299.0` → `10.0.17763.0` | WinUI 2.8 NuGet package requires min version ≥ 10.0.17763.0 |

> ⚠️ These patches are in `node_modules`. If you run `npm install` or `npm ci`, re-apply them by running the Windows build once — they will fail and the error messages will remind you which files to patch.

### Hot reload on Windows

JS changes are picked up automatically via Metro's fast refresh — **no rebuild needed**.
To manually reload: press `Ctrl+H` in the app window to open the Dev Menu → **Reload JS**.

---

## Environment / API Config

The server URL is set **inside the app** on the Login screen (not via `.env`).

- Default for emulator: `http://10.0.2.2:8000`
- Default for physical device on the same Wi-Fi: `http://<your-machine-LAN-IP>:8000`

The URL is saved to AsyncStorage via `authStore` and persists across sessions.

The Axios client (`src/api/client.ts`) reads `authStore.serverUrl` and `authStore.token` via an interceptor on every request.

---

## Printer Support

Configure under **Settings → Printer Settings**.

### Bluetooth
1. Pair the printer in Android Bluetooth settings first.
2. Open the Bluetooth tab → tap **↻ Scan** → select your printer.

### Network (Wi-Fi / LAN)
1. Open the Network tab → tap **🔍 Scan** to auto-discover printers on port 9100.
2. Or use **Manual entry** to type the IP directly.
3. Most ESC/POS printers default to port `9100`.

### USB (OTG)
1. Connect the printer with a USB OTG cable.
2. Open the USB tab → tap **↻ Scan** → select the device.

### System (Android Print Dialog)
- No configuration needed.
- Tap **🖨 Test print** to open the Android system print dialog.
- Supports any Mopria-compatible Wi-Fi printer, Google Drive (save as PDF), and local storage.
- KOTs and receipts are rendered as HTML for clean A4/letter output.

### Paper width
Select **58 mm** or **80 mm** to match your roll width. Affects ESC/POS column formatting.

### Auto-print
| Toggle | When it fires |
|--------|---------------|
| Print KOT automatically | After every "Send KOT" tap |
| Print receipt automatically | After payment is confirmed |

---

## Sync Engine

The sync runs automatically on login and can be triggered manually from the Settings screen.

### Pull sequence (server → local)
Entities are pulled in dependency order:

```
units → item_groups → items → item_variants
→ modifier_groups + modifiers → combos
→ floor_plans → dining_tables
→ orders (paginated) → kots
```

For each record:
- If `server_id` matches a local row with `sync_state = 'pending'` → **skip** (local changes win)
- If `server_id` matches a synced row → **update**
- No match → **create**

### Push sequence (local → server)
- Orders with `sync_state = 'pending'` are pushed after each local action (KOT send, hold, checkout)
- Push is fire-and-forget inside `setTimeout(0)` — the UI never blocks on network
- Failed pushes remain `pending` and retry on next sync

---

## Troubleshooting

### Metro ECONNREFUSED on device

The ADB reverse tunnel was not set up (resets on cable reconnect):

```powershell
adb reverse tcp:8081 tcp:8081
```

### Gradle fails — JDK not found

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

Add this before every Gradle command on Windows.

### `react-native-ping` crash on Android 14+

Already fixed — the module is stubbed via Metro `extraNodeModules` in `metro.config.js`. The stub lives at `src/mocks/react-native-ping.js` and always returns success so the thermal printer library's network connect path works correctly.

### App shows blank screen after install

Metro is not running or the tunnel is broken:
1. Make sure `npx react-native start` is running in its terminal.
2. Run `adb reverse tcp:8081 tcp:8081` again.
3. Shake the device → **Reload**.

### Printer not found over network

1. Verify the printer and device are on the same Wi-Fi/LAN subnet.
2. Use the **🔍 Scan** button — it probes `.1–.254` on port 9100 in batches.
3. Edit the subnet prefix if your network uses a different range (e.g. `192.168.0`).
4. Fall back to **Manual entry** if you know the printer's IP.

### WatermelonDB schema mismatch after schema change

```powershell
# Uninstall the app from the device, then reinstall:
adb uninstall com.rc
.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
```

Or use the **Reset local DB** option in Settings (if available).

### Orders not syncing to server

1. Check that the API is running: `make logs` from `D:\erp\pos`.
2. Verify the server URL in Settings matches the API address.
3. Check logcat for `[orderActions]` lines:
   ```powershell
   adb logcat -s ReactNativeJS | findstr orderActions
   ```

---

## Windows-specific Troubleshooting

### `Could not find MSBuild for Visual Studio 19.0.0`

RNW CLI defaults to VS 19.x. Override with:
```powershell
$env:MinimumVisualStudioVersion = "18.0.0"
```

### `The Windows SDK version 10.0.22621.0 was not found`

Pass your installed SDK version:
```powershell
npx react-native run-windows --msbuildprops "WindowsTargetPlatformVersion=10.0.26100.0"
```

To check which SDK you have installed:
```powershell
[System.IO.Directory]::GetDirectories("C:\Program Files (x86)\Windows Kits\10\Include") | ForEach-Object { Split-Path $_ -Leaf }
```

### `error C2338: STL1011 — <experimental/coroutine> deprecated`

The `_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS` preprocessor define is missing.
Check that `windows/ExperimentalFeatures.props` and `Directory.Build.props` (project root) contain:
```xml
<PreprocessorDefinitions>_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS;%(PreprocessorDefinitions)</PreprocessorDefinitions>
```

### `error C2220: warning treated as error` (OriginPolicyHttpFilter or similar)

The `/Wv:17` compiler flag is missing from `Directory.Build.props`.
Check that both `Directory.Build.props` (project root) and
`node_modules\react-native-windows\Directory.Build.props` contain:
```xml
<AdditionalOptions>/Wv:17 %(AdditionalOptions)</AdditionalOptions>
```

### `Microsoft.UI.Xaml requires TargetPlatformMinVersion >= 10.0.17763.0`

`react-native-print`'s project file has too low a minimum. Edit:
`node_modules\react-native-print\windows\RNPrint\RNPrint.vcxproj`
and change:
```xml
<WindowsTargetPlatformMinVersion>10.0.16299.0</WindowsTargetPlatformMinVersion>
```
to:
```xml
<WindowsTargetPlatformMinVersion>10.0.17763.0</WindowsTargetPlatformMinVersion>
```

### App opens but shows blank / red error screen

Metro is not running. Open a separate terminal and run:
```powershell
cd D:\erp\pos\rc
npx react-native start
```
Then press `Ctrl+H` in the app → **Reload JS**.
