# Zazzy POS

Restaurant point-of-sale system with an Electron desktop client, a React Native mobile/Windows client, and a shared Laravel API backend.

## Repository Layout

```
D:\erp\pos\
├── api/               # Laravel 11 + MySQL (Docker) — shared REST API
├── electron-app/      # Electron 32 + React 19 + Vite + TypeScript (Windows desktop POS)
├── react-native-app/  # React Native 0.75 + WatermelonDB (Android + Windows desktop)
└── Makefile           # Docker Compose helpers for the API
```

Each sub-project has its own README with full detail:

| Directory | README |
|-----------|--------|
| `api/` | [api/README.md](api/README.md) |
| `electron-app/` | [electron-app/README.md](electron-app/README.md) |
| `react-native-app/` | [react-native-app/README.md](react-native-app/README.md) |

## Quick Start

### 1. Start the API

Run from the repo root. All artisan commands execute inside Docker.

```powershell
make start              # start api + mysql containers
make install            # composer install (first time only)
make migrate-fresh-seed # run migrations + seed
```

API will be available at `http://localhost:8000`.

### 2. Start the Electron desktop app

```powershell
cd electron-app
npm install
npm run dev             # starts main + renderer with HMR
```

On first launch, a setup wizard prompts for the API server URL.

### 3. Start the React Native app (Android)

```powershell
cd react-native-app
npm install

# Terminal 1 — Metro bundler
npx react-native start

# Terminal 2 — install on device
adb reverse tcp:8081 tcp:8081
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
```

### 3b. React Native Windows desktop

```powershell
$env:MinimumVisualStudioVersion = "18.0.0"
cd react-native-app
npx react-native run-windows --msbuildprops "WindowsTargetPlatformVersion=10.0.26100.0"
```

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make start` | `docker compose up -d` (api + mysql) |
| `make install` | `composer install` inside api container |
| `make migrate-fresh-seed` | `migrate:fresh --seed` |
| `make migrate` | `php artisan migrate` |
| `make seed` | `php artisan db:seed` |
| `make pos-fresh` | `migrate:fresh --seed` + delete local SQLite DB |
| `make logs` | Tail API container logs |
| `make down` | Stop containers |

## Architecture Overview

```
┌─────────────────────┐   ┌───────────────────────────┐
│  Electron App        │   │  React Native App          │
│  (Windows desktop)   │   │  (Android / Windows)       │
│                      │   │                            │
│  better-sqlite3      │   │  WatermelonDB (SQLite)     │
│  (offline-first)     │   │  (offline-first)           │
└────────┬────────────┘   └────────────┬───────────────┘
         │  REST + Sanctum              │  REST + Sanctum
         └──────────────┬──────────────┘
                        ▼
           ┌────────────────────────┐
           │  Laravel API (Docker)  │
           │  MySQL — zazzy_pos DB  │
           └────────────────────────┘
```

**Offline-first design:** Both clients write to local SQLite immediately. Server sync runs in the background (fire-and-forget) and retries on failure. The API is never on the critical path for core POS actions (billing, KOT, payment).

## Critical Version Constraints

| Package | Required | Why |
|---------|----------|-----|
| `better-sqlite3` | **v11+** | v9 breaks with Electron 32 (C++20/V8 API incompatibility) |
| `electron-store` | **v8** | v10 is ESM-only — breaks CJS main process |
| `electron` | **32.3.3** | ABI target for native module compilation |

## Database

- **Server:** MySQL via Docker (`zazzy_pos` database)
- **Electron local:** SQLite via `better-sqlite3` in the main process
- **React Native local:** WatermelonDB (SQLite)
- **Migration policy:** Do NOT create new migrations during the initial phase — edit the original migration file and re-run `migrate:fresh --seed`

## API Base URL

All endpoints live under `/api/v1/` and require a Sanctum Bearer token (except `/login`, `/register`, `/health`, and public invoice routes). See [api/README.md](api/README.md) for the full endpoint reference.
