# Zazzy POS — Project Root

Restaurant POS system. Electron desktop client + React Native mobile client, both backed by a single Laravel API.

## Directory Layout

```
D:\erp\pos\
├── electron-app/    # Electron 32 + React 19 + Vite + TypeScript (desktop POS)
├── mobile-app/      # Expo SDK 54 + React Native (waitstaff mobile POS)
├── desktop-react/   # React Native Windows 0.76 (Windows-native desktop POS)
├── api/             # Laravel — own MySQL via Docker (api/docker-compose.yml)
└── Makefile         # COMPOSE points to api/docker-compose.yml
```

> Each sub-project has its own `AGENTS.md` with full details:
> - [`electron-app/AGENTS.md`](electron-app/AGENTS.md) — Electron desktop app
> - [`mobile-app/AGENTS.md`](mobile-app/AGENTS.md) — React Native mobile app
> - [`desktop-react/AGENTS.md`](desktop-react/AGENTS.md) — React Native Windows desktop app

## How to Run

```bash
# Laravel API + MySQL (Docker)
make start           # docker compose -f api/docker-compose.yml up -d

# Electron app (dev) — run in a terminal, not Docker
cd electron-app
npm run dev          # starts main + renderer with HMR

# Build distributable
cd electron-app
npm run build        # outputs to out/
```

## Common Make Targets

```bash
make start               # bring up api + mysql containers
make install             # composer install inside the api container (run once after make start)
make pos-fresh           # migrate:fresh --seed + delete local SQLite DB
make migrate-fresh-seed  # migrate:fresh --seed only
make migrate             # php artisan migrate
make seed                # php artisan db:seed
make logs                # tail api logs
make down                # stop containers
```

> **First-time / fresh start workflow:**
> ```bash
> make start     # start containers (composer install runs in background)
> make install   # wait for / confirm composer install completes
> make migrate-fresh-seed
> ```
> All artisan commands run inside the Docker `api` container.

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

## API Backend

The `api/` is a standalone Laravel app with its own MySQL database (`zazzy_pos`) running in Docker. It is **separate from the ERP** (`D:\erp\erp\`). Restaurant-specific controllers are added alongside ERP-derived controllers. Restaurant report routes must appear BEFORE ERP report routes in `routes/api.php`.

## Backend API Endpoints in Use

All under `/api/v1/` (Laravel sanctum auth required unless marked public).

### Auth (public)
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `POST /login` | AuthController@login | public |
| `POST /register` | AuthController@register | public |
| `GET /health` | inline | `{ ok: true, app: 'Zazzy POS' }` |
| `GET /public/invoices/{token}` | PublicInvoiceController@show | public invoice view |

### Auth (authenticated)
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /me` | AuthController@me | current user |
| `PUT /auth/profile` | AuthController@updateProfile | |
| `POST /auth/profile/avatar` | AuthController@uploadAvatar | multipart |
| `PUT /auth/password` | AuthController@updatePassword | |
| `POST /logout`, `POST /logout-all` | AuthController | session termination |

### Dashboard
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /dashboard/stats` | DashboardController@stats | |
| `GET /dashboard/chart` | DashboardController@chart | |
| `GET /dashboard/collection` | DashboardController@collection | |

### Sync (used by SyncWorker)
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `POST /sync/push` | SyncController@push | |
| `GET /sync/pull` | SyncController@pull | |

### Items / Units / Groups
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /items` | ItemController@index | `?per_page`, `?search`, `?is_active`, `?item_group_id` |
| `POST /items` | ItemController@store | requires `name`, `unit`; CGST/SGST/IGST optional |
| `GET /items/{id}` | ItemController@show | returns item with batches + alternate units |
| `PATCH /items/{id}` | ItemController@update | partial update via 'sometimes' |
| `DELETE /items/{id}` | ItemController@destroy | soft delete |
| `GET /item-groups` | ItemGroupController | flat list |
| `GET /units` | UnitController@index | `?status=active&per_page=500` |
| `GET/POST/PATCH/DELETE /item-variants` | ItemVariantController | scoped by `item_id` |
| `GET /item-modifier-groups` | ItemModifierGroupController@index | junction data |
| `GET/POST/PATCH/DELETE /modifier-groups` | ModifierGroupController | |
| `POST /modifier-groups/{id}/modifiers` | ModifierGroupController@storeModifier | nested modifier CRUD |
| `PATCH /modifier-groups/{id}/modifiers/{modifier}` | ModifierGroupController@updateModifier | |
| `DELETE /modifier-groups/{id}/modifiers/{modifier}` | ModifierGroupController@destroyModifier | |
| `GET/POST/PATCH/DELETE /combos` | ComboController | |
| `GET/POST/PATCH/DELETE /recipes` | RecipeController | |

### Stock / Batches
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /stock-ledger` | StockLedgerController@index | |
| `GET /stock-summary` | StockLedgerController@summary | |
| `POST /stock-ledger/opening` | StockLedgerController@opening | |
| `POST /stock-ledger/adjustment` | StockLedgerController@adjustment | |
| `POST /stock-ledger/transfer` | StockLedgerController@transfer | |
| `GET /stock-ledger/reorder-alerts` | StockLedgerController@reorderAlerts | |
| `GET /items/{id}/movements` | StockLedgerController@itemMovements | |
| `GET /batches`, `GET /batches/expiring` | BatchController | |
| `GET/POST /items/{id}/batches` | BatchController | |
| `PUT/DELETE /batches/{batch}` | BatchController | |

### Media
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `POST /media` | MediaController@store | multipart; `entity_type`, `entity_id`, `is_primary` as `'1'`/`'0'` |
| `GET /media` | MediaController@index | `?entity_type=&entity_id=` — **both required** (single-entity fetch) |
| `GET /media/sync` | MediaController@sync | `?entity_type=item&per_page=200` — bulk paginated, **no entity_id** (POS sync only) |
| `DELETE /media/{id}` | MediaController@destroy | |
| `PATCH /media/{id}/set-primary` | MediaController@setPrimary | |

### Restaurant Orders / Tables
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET/POST /restaurant/orders` | RestaurantOrderController | GET supports `?per_page`, `?page` |
| `GET /restaurant/orders/{id}` | RestaurantOrderController@show | |
| `POST /restaurant/orders/{id}/lines` | RestaurantOrderController@addLines | |
| `DELETE /restaurant/orders/{id}/lines/{line}` | RestaurantOrderController@removeLine | |
| `POST /restaurant/orders/{id}/kot` | RestaurantOrderController@generateKot | |
| `POST /restaurant/orders/{id}/checkout` | RestaurantOrderController@checkout | |
| `POST /restaurant/orders/{id}/hold` | RestaurantOrderController@hold | |
| `POST /restaurant/orders/{id}/unhold` | RestaurantOrderController@unhold | |
| `POST /restaurant/orders/{id}/cancel` | RestaurantOrderController@cancel | |
| `POST /restaurant/orders/{id}/transfer-table` | RestaurantOrderController@transferTable | |
| `GET /floor-plans` (+ apiResource CRUD) | FloorPlanController | |
| `GET /dining-tables` (+ apiResource CRUD) | DiningTableController | `?is_active=1` |
| `PATCH /dining-tables/{id}/status` | DiningTableController@updateStatus | |
| `POST /dining-tables/{id}/merge` | DiningTableController@merge | |
| `GET /godowns` (+ apiResource CRUD) | GodownController | |

### KOTs
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /kots`, `GET /kots/{id}` | KotController | |
| `PATCH /kots/{id}/status` | KotController@updateStatus | |
| `PATCH /kots/{id}/lines/{line}/status` | KotController@updateLineStatus | |
| `POST /kots/{id}/reprint` | KotController@reprint | |

### Reports — POS (Restaurant)
> ⚠️ These restaurant report routes **must appear BEFORE** the generic ERP report routes in `routes/api.php`.

| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET /reports/sales-summary` | RestaurantReportController@salesSummary | |
| `GET /reports/item-wise` | RestaurantReportController@itemWise | |
| `GET /reports/day-close` | RestaurantReportController@dayClose | |
| `GET /reports/gst-summary` | RestaurantReportController@gstSummary | |
| `GET /reports/payment-mode` | RestaurantReportController@paymentMode | |

### Parties (customers/suppliers)
| Endpoint | Controller | Notes |
|----------|-----------|-------|
| `GET/POST/PATCH/DELETE /parties` | PartyController | electron-app pushes local customers here via `POST /parties` (`type: 'customer'`) |
| `GET /parties/{id}/balance` | PartyController@balance | |

> Other ERP routes (purchase/sales invoices, payroll, accounting, finance, branches/users/roles, etc.) are also mounted under `/api/v1/` but are not consumed by the POS clients. See `api/routes/api.php` for the full list.
