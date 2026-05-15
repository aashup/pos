# Zazzy POS — Project Root

Restaurant POS system. Electron desktop client + React Native mobile client, both backed by a single Laravel API.

## Directory Layout

```
D:\erp\pos\
├── electron-app/    # Electron 32 + React 19 + Vite + TypeScript (desktop POS)
├── mobile-app/      # Expo SDK 54 + React Native (waitstaff mobile POS)
├── api/             # Laravel — own MySQL via Docker (api/docker-compose.yml)
└── Makefile         # COMPOSE points to api/docker-compose.yml
```

> Each sub-project has its own `CLAUDE.md` with full details:
> - [`electron-app/CLAUDE.md`](electron-app/CLAUDE.md) — Electron desktop app
> - [`mobile-app/CLAUDE.md`](mobile-app/CLAUDE.md) — React Native mobile app

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
| `GET /media` | MediaController@index | `?entity_type=&entity_id=` — **both required** (use for single-entity fetch) |
| `GET /media/sync` | MediaController@sync | `?entity_type=item&per_page=200` — bulk paginated, **no entity_id** (POS sync only) |
| `DELETE /media/{id}` | MediaController@destroy | |
| `GET/POST /restaurant/orders` | RestaurantOrderController | GET supports `?per_page`, `?page` |
| `POST /restaurant/orders/{id}/lines` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/kot` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/checkout` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/hold` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/unhold` | RestaurantOrderController | |
| `POST /restaurant/orders/{id}/cancel` | RestaurantOrderController | |
| `GET /floor-plans` | FloorPlanController | |
| `GET /dining-tables` | DiningTableController | `?is_active=1` |
| `GET /godowns` | GodownController | |
