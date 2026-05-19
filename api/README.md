# Zazzy POS — API Backend

Laravel 11 REST API backing the Zazzy POS desktop and mobile clients. Runs in Docker with MySQL.

## Stack

- **Laravel 11** + Sanctum (token auth)
- **MySQL** (`zazzy_pos` database) via Docker
- **DomPDF** (`barryvdh/laravel-dompdf`) for payslip PDFs
- UUID primary keys everywhere (no integer IDs)

## Quick Start

Run all commands from the repo root (`D:\erp\pos\`), not from `api/`.

```bash
# First time
make start              # start api + mysql containers
make install            # composer install inside container
make migrate-fresh-seed # run migrations + seed data

# Day-to-day
make start              # bring containers up
make logs               # tail api logs
make down               # stop containers
```

> All `php artisan` commands run **inside** the Docker `api` container.
> Use `docker compose exec api php artisan <command>` or the Make targets.

## Directory Layout

```
api/
├── app/
│   ├── Http/Controllers/Api/V1/   # All API controllers
│   ├── Models/                    # Eloquent models (27+)
│   ├── Observers/                 # PartyObserver, CompanyObserver
│   ├── Policies/                  # 17 authorization policies
│   ├── Services/                  # AccountingService, InventoryDeductionService, PayrollService, InvoicePdfService
│   └── Traits/                    # HasUuid, HasSyncColumns, BelongsToCompany, FiltersByFinancialYear
├── database/
│   ├── migrations/                # 31 ordered migration files
│   └── seeders/
├── routes/api.php                 # All routes under /api/v1
├── Dockerfile
└── docker-compose.yml
```

## Migration Policy

**Do NOT create new migrations.** The project is in initial phase — always edit the original migration file directly, then rebuild:

```bash
make migrate-fresh-seed
```

## API Endpoints

All routes are under `/api/v1/`. Most require `auth:sanctum` (Bearer token).

### Public

| Method | Path | Notes |
|--------|------|-------|
| POST | `/login` | Returns token + user + permissions |
| POST | `/register` | |
| GET | `/health` | `{ ok: true, app: 'Zazzy POS' }` |
| GET | `/public/invoices/{token}` | Public invoice view |

### Auth / Profile

| Method | Path |
|--------|------|
| GET | `/me` |
| PUT | `/auth/profile` |
| POST | `/auth/profile/avatar` |
| PUT | `/auth/password` |
| POST | `/logout` / `/logout-all` |

### Restaurant Orders

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/restaurant/orders` | |
| GET | `/restaurant/orders/{id}` | |
| POST | `/restaurant/orders/{id}/lines` | Add items |
| DELETE | `/restaurant/orders/{id}/lines/{line}` | |
| POST | `/restaurant/orders/{id}/kot` | Generate KOT |
| POST | `/restaurant/orders/{id}/checkout` | Finalize + post accounting |
| POST | `/restaurant/orders/{id}/hold` / `/unhold` | |
| POST | `/restaurant/orders/{id}/cancel` | |
| POST | `/restaurant/orders/{id}/transfer-table` | |

### Tables & Floor Plans

| Method | Path |
|--------|------|
| GET/POST/PATCH/DELETE | `/floor-plans` |
| GET/POST/PATCH/DELETE | `/dining-tables` |
| PATCH | `/dining-tables/{id}/status` |
| POST | `/dining-tables/{id}/merge` |

### KOTs (Kitchen Order Tickets)

| Method | Path |
|--------|------|
| GET | `/kots` / `/kots/{id}` |
| PATCH | `/kots/{id}/status` |
| PATCH | `/kots/{id}/lines/{line}/status` |
| POST | `/kots/{id}/reprint` |

### Items / Inventory

| Method | Path | Notes |
|--------|------|-------|
| GET | `/items` | `?per_page`, `?search`, `?is_active`, `?item_group_id` |
| POST | `/items` | requires `name`, `unit` |
| GET/PATCH/DELETE | `/items/{id}` | |
| GET | `/item-groups` | flat list |
| GET | `/units` | `?status=active&per_page=500` |
| CRUD | `/item-variants` | scoped by `item_id` |
| CRUD | `/modifier-groups` | + nested modifier CRUD |
| CRUD | `/combos` | |
| CRUD | `/recipes` | |

### Stock

| Method | Path |
|--------|------|
| GET | `/stock-ledger`, `/stock-summary` |
| POST | `/stock-ledger/opening`, `/stock-ledger/adjustment`, `/stock-ledger/transfer` |
| GET | `/stock-ledger/reorder-alerts` |
| GET | `/items/{id}/movements` |
| GET | `/batches`, `/batches/expiring` |

### Media

| Method | Path | Notes |
|--------|------|-------|
| POST | `/media` | multipart upload |
| GET | `/media` | requires `entity_type` + `entity_id` |
| GET | `/media/sync` | bulk paginated (POS sync worker) — no `entity_id` |
| DELETE | `/media/{id}` | |
| PATCH | `/media/{id}/set-primary` | |

> ⚠️ `GET /media/sync` must be registered **before** `GET /media/{medium}` in `routes/api.php`.

### Reports — POS (Restaurant)

> ⚠️ These routes **must appear before** the generic ERP report routes in `routes/api.php`.

| Method | Path |
|--------|------|
| GET | `/reports/sales-summary` |
| GET | `/reports/item-wise` |
| GET | `/reports/day-close` |
| GET | `/reports/gst-summary` |
| GET | `/reports/payment-mode` |

### Parties

| Method | Path | Notes |
|--------|------|-------|
| CRUD | `/parties` | `type: 'customer'` or `'vendor'` or `'both'` |
| GET | `/parties/{id}/balance` | |

> Creating a Party auto-creates accounting ledger(s) via `PartyObserver`.

### Dashboard & Sync

| Method | Path |
|--------|------|
| GET | `/dashboard/stats`, `/dashboard/chart`, `/dashboard/collection` |
| POST | `/sync/push` |
| GET | `/sync/pull` |

## Key Architecture

### Authentication
Sanctum token auth. Login returns `{ token, user, permissions[] }`. Permissions are flat strings like `inventory.view`.

### UUID Primary Keys
All tables use UUID PKs. No integer IDs. Roles/permissions also use `uuid` (not `id`) as the primary key field.

### Accounting (Double-Entry)
Every checkout posts a balanced journal voucher via `AccountingService::postPOSSale()`. Vouchers are append-only — no edits or deletes, only reversals.

### Financial Year
FY is always resolved **server-side** from the document date. The frontend never sends `financial_year_id`.

### Multi-tenant
`BelongsToCompany` trait auto-sets `company_id` on create and applies a global scope — all queries are automatically scoped to the authenticated user's company.

### Offline Sync
`HasSyncColumns` trait adds `sync_status`, `device_id`, `synced_at` to every model. The electron app's `SyncWorker` calls individual resource endpoints directly (not the `/sync/push` / `/sync/pull` endpoints).

## Payslip PDF

```bash
GET /api/v1/payroll-runs/{id}/payslip/{employeeId}
```

Uses DomPDF + `resources/views/payroll/payslip.blade.php`. After editing the template, clear the view cache:

```bash
docker compose exec api php artisan view:clear
```

> ⚠️ Use `Rs.` instead of `₹` in the blade template — the default DomPDF font lacks the rupee glyph in regular weight.

## Tally Import

| Method | Path |
|--------|------|
| GET | `/tally/test-connection` |
| GET | `/tally/test-odbc-connection` |
| GET | `/tally/fetch-ledgers?connection_method=xml\|odbc` |
| POST | `/tally/import-ledgers` |
| GET | `/tally/fetch-stock-items?connection_method=xml\|odbc` |
| POST | `/tally/import-stock-items` |
| POST | `/tally/import-vouchers` |

Supports both XML-over-HTTP (port 9000) and ODBC connection methods.
