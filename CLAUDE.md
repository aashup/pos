# Zazzy POS — Project Root

Restaurant POS desktop application. Electron + React client with Laravel cloud backend.

## Directory Layout

```
/Users/aashu/code/pos/
├── electron-app/    # Electron 32 + React 19 + Vite + TypeScript
└── api/             # Laravel (shares MySQL with /Users/aashu/erp/api)
```

## How to Run

```bash
# Electron app (dev)
cd /Users/aashu/code/pos/electron-app
npm run dev          # starts main + renderer with HMR

# Laravel API
cd /Users/aashu/code/pos/api
php artisan serve    # runs on http://127.0.0.1:8000

# Build distributable
cd /Users/aashu/code/pos/electron-app
npm run build        # outputs to out/
```

## Critical Version Constraints — DO NOT CHANGE

| Package | Required | Why |
|---------|----------|-----|
| `better-sqlite3` | **v11+** | v9 breaks with Electron 32 (C++20/V8 API incompatibility) |
| `electron-store` | **v8** | v10 is ESM-only — breaks CJS main process |
| `electron` | 32.3.3 | native module ABI target |

## Key Architecture Decisions

- **No Dexie/IndexedDB** — all local data via IPC to `better-sqlite3` in main process
- **Cart state is Zustand only** — SQLite written only on KOT send / hold / payment
- **HashRouter** — Electron loads `file://` URLs, history router doesn't work
- **schema.sql uses `?raw` import** — NOT `readFileSync` (causes ENOENT in packaged builds)

## Database Migration Policy

**Do NOT create new migrations** — the project is in initial phase. Always edit the original migration file directly, then re-run `php artisan migrate:fresh --seed` to rebuild the database.

## Shared Laravel Backend

The `api/` shares the same MySQL database and codebase as `/Users/aashu/erp/api`.
Restaurant-specific controllers are added alongside ERP controllers.
Restaurant report routes must appear BEFORE ERP report routes in `routes/api.php`.
