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

## Backend API Endpoints in Use

All under `/api/v1/` (Laravel sanctum auth required).

| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /items` | ItemController@index | `?per_page`, `?search`, `?is_active`, `?item_group_id` |
| `POST /items` | ItemController@store | requires `name`, `unit`; CGST/SGST/IGST optional |
| `GET /items/{id}` | ItemController@show | returns item with batches + alternate units |
| `PATCH /items/{id}` | ItemController@update | partial update via 'sometimes' validation |
| `DELETE /items/{id}` | ItemController@destroy | soft delete |
| `GET /item-groups` | ItemGroupController | flat list |
| `GET /units` | UnitController@index | `?status=active&per_page=500` |
| `GET/POST/PATCH/DELETE /item-variants` | ItemVariantController | scoped by `item_id` |
| `GET/POST/PATCH/DELETE /modifier-groups` | ModifierGroupController | |
| `POST /media` | MediaController@store | multipart; `entity_type`, `entity_id`, `is_primary` as `'1'`/`'0'` |
| `GET /media` | MediaController@index | `?entity_type=item&entity_id=` |
| `DELETE /media/{id}` | MediaController@destroy | |
| `GET/POST /restaurant/orders` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/lines` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/kot` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/checkout` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/hold` | RestaurantOrderController | |
