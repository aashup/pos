# Laravel API — Migrations, Models, Policies & Auth Setup

> This plan is also saved to `/Users/aashu/erp/api/PLAN.md` for persistence.

## Context
Setting up the Laravel API backend foundation for the offline-first ERP system. This includes all database migrations (with UUID + sync columns), Eloquent models, authorization policies, and Sanctum-based authentication. Everything follows the CLAUDE.md architecture spec.

---

## Phase 0: Package Installation & Config

### 0.1 — Install packages
```bash
cd /Users/aashu/erp/api
composer require laravel/sanctum spatie/laravel-permission spatie/laravel-activitylog
```

### 0.2 — Publish vendor assets
```bash
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-migrations"
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-config"
```

### 0.3 — Register API routes in `bootstrap/app.php`
Add `api: __DIR__.'/../routes/api.php'` to `withRouting()`

### 0.4 — Register middleware aliases in `bootstrap/app.php`
```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'active' => \App\Http\Middleware\EnsureUserIsActive::class,
        'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
    ]);
})
```

---

## Phase 1: Foundation Traits (3 files)

### `app/Traits/HasUuid.php`
- `getIncrementing()` → false
- `getKeyType()` → 'string'
- `bootHasUuid()` → auto-generate UUID on creating

### `app/Traits/HasSyncColumns.php`
- Adds sync fields to `$fillable` and `$casts`
- `markAsSynced()`, `markAsConflict()`
- Scopes: `scopePending()`, `scopeSynced()`, `scopeConflicts()`

### `app/Traits/BelongsToCompany.php`
- Auto-set `company_id` from auth user on creating
- Global scope to filter by tenant `company_id`
- `company()` relationship

---

## Phase 2: Migrations (25 files, dependency-ordered)

All tables get these sync columns:
```
uuid id PK, sync_status ENUM, device_id, synced_at, updated_at_local, timestamps
```

| # | Migration | Table(s) | Key Columns |
|---|-----------|----------|-------------|
| 1 | `create_companies_table` | companies | name, gstin, pan, state_code, address, phone, email |
| 2 | `modify_users_table` | users (drop+recreate) | company_id FK, branch_id FK, role ENUM(admin/manager/accountant/salesman), is_active |
| 3 | `create_branches_table` | branches | company_id FK, name, code, state_code, is_active |
| 4 | Spatie permission tables | roles, permissions, model_has_roles, model_has_permissions, role_has_permissions | **Managed by Spatie** — use published migration |
| 5 | `create_financial_years_table` | financial_years | company_id FK, label, start/end_date, is_locked, is_current |
| 6 | `create_chart_of_accounts_table` | chart_of_accounts | company_id FK, parent_id (self-ref), name, type ENUM, group ENUM, is_system |
| 7 | `create_parties_table` | parties | company_id FK, type(customer/vendor/both), gstin, state_code, credit_limit, opening_balance |
| 8 | `create_items_table` | items | company_id FK, name, hsn_code, unit, gst_rate, mrp, reorder_level, is_batch_tracked |
| 9 | `create_batches_table` | batches | item_id FK, batch_number, expiry_date, purchase/selling_price |
| 10 | `create_godowns_table` | godowns | company_id FK, branch_id FK, name, is_default |
| 11 | `create_stock_ledger_table` | stock_ledger | item_id, batch_id, godown_id, type ENUM, quantity, rate, value — **NO softDeletes** |
| 12 | `create_purchase_orders_table` | purchase_orders | company_id, party_id, po_number, status ENUM, totals |
| 13 | `create_po_lines_table` | po_lines | purchase_order_id, item_id, qty, rate, GST splits |
| 14 | `create_purchase_invoices_table` | purchase_invoices | company_id, party_id, invoice_number, is_inter_state, GST totals, balance_due |
| 15 | `create_purchase_invoice_lines_table` | purchase_invoice_lines | purchase_invoice_id, item_id, batch_id, GST splits |
| 16 | `create_purchase_returns_table` | purchase_returns + lines | purchase_invoice_id, return_number |
| 17 | `create_sales_orders_table` | sales_orders | company_id, party_id, so_number, status |
| 18 | `create_so_lines_table` | so_lines | sales_order_id, item_id |
| 19 | `create_sales_invoices_table` | sales_invoices | company_id, party_id, invoice_number, **is_printed** (for conflict rule) |
| 20 | `create_sales_invoice_lines_table` | sales_invoice_lines | sales_invoice_id, item_id, batch_id |
| 21 | `create_sales_returns_table` | sales_returns + lines | sales_invoice_id, return_number |
| 22 | `create_payment_receipts_table` | payment_receipts | party_id, type(payment/receipt), amount, payment_mode |
| 23 | `create_journal_entries_table` | journal_entries | financial_year_id, voucher_number/type, is_posted — **NO softDeletes** |
| 24 | `create_journal_lines_table` | journal_lines | journal_entry_id, account_id, debit, credit |
| 25 | Spatie audit log migration | (use published migration) | |

**Note:** Migration #2 drops and recreates users table (auto-increment → UUID conversion).

---

## Phase 3: Models (23 files — no custom RolePermission model, Spatie handles roles/permissions)

Every model uses `HasUuid` + `HasSyncColumns`. Most also use `BelongsToCompany` + `SoftDeletes` + `LogsActivity`.

| Model | Key Relationships | Special Notes |
|-------|-------------------|---------------|
| Company | hasMany: users, branches, parties, items, godowns | Root tenant |
| User | belongsTo: company, branch | Uses `HasApiTokens`, `HasRoles` (Spatie). Permissions checked via `$user->hasPermissionTo()` |
| Branch | belongsTo: company | |
| FinancialYear | belongsTo: company | |
| ChartOfAccount | belongsTo: company, parent(self). hasMany: children | Self-referencing tree |
| Party | belongsTo: company. hasMany: POs, invoices, payments | type: customer/vendor/both |
| Item | belongsTo: company. hasMany: batches, stockLedger | |
| Batch | belongsTo: item | |
| Godown | belongsTo: company, branch | |
| StockLedger | belongsTo: item, batch, godown. morphTo: reference | **No SoftDeletes** (append-only) |
| PurchaseOrder/Lines | Standard parent-child | |
| PurchaseInvoice/Lines | Standard parent-child | |
| PurchaseReturn/Lines | belongsTo: purchaseInvoice | |
| SalesOrder/Lines | Standard parent-child | |
| SalesInvoice/Lines | Standard parent-child | `is_printed` flag |
| SalesReturn/Lines | belongsTo: salesInvoice | |
| PaymentReceipt | belongsTo: company, party | |
| JournalEntry/Lines | Entry→Lines, Line→account | **No SoftDeletes** (append-only) |

---

## Phase 4: Policies (12 files)

All in `app/Policies/`. Auto-discovered by Laravel convention.

Each policy checks: **same company** + **Spatie permission** (e.g. `inventory.view`, `purchase.create`).

### Spatie Permissions (seeded)
```
inventory.view, inventory.create, inventory.edit, inventory.delete
purchase.view, purchase.create, purchase.edit, purchase.delete
sales.view, sales.create, sales.edit, sales.delete
accounting.view, accounting.create, accounting.edit, accounting.delete
settings.view, settings.create, settings.edit, settings.delete
```

### Spatie Roles (seeded with permissions)
- **admin** — all permissions
- **manager** — all except settings.delete
- **accountant** — accounting.*, inventory.view, purchase.view, sales.view
- **salesman** — sales.*, inventory.view

### Policy files

| Policy | Permission prefix | Methods |
|--------|-------------------|---------|
| CompanyPolicy | settings | viewAny, view, update |
| ItemPolicy | inventory | viewAny, view, create, update, delete |
| BatchPolicy | inventory | viewAny, view, create, update, delete |
| GodownPolicy | inventory | viewAny, view, create, update, delete |
| PartyPolicy | purchase OR sales | viewAny, view, create, update, delete |
| PurchaseOrderPolicy | purchase | viewAny, view, create, update, delete |
| PurchaseInvoicePolicy | purchase | viewAny, view, create, update, delete |
| SalesOrderPolicy | sales | viewAny, view, create, update, delete |
| SalesInvoicePolicy | sales | viewAny, view, create, update, delete |
| PaymentReceiptPolicy | accounting | viewAny, view, create, update, delete |
| JournalEntryPolicy | accounting | viewAny, view, create |
| ChartOfAccountPolicy | accounting | viewAny, view, create, update, delete |

Policy pattern (example):
```php
public function view(User $user, Item $item): bool {
    return $user->company_id === $item->company_id
        && $user->hasPermissionTo('inventory.view');
}
```

---

## Phase 5: Auth Setup

### Middleware (1 custom file in `app/Http/Middleware/`)
- **EnsureUserIsActive** — returns 403 if `user->is_active` is false
- Spatie's `PermissionMiddleware` and `RoleMiddleware` handle permission checks (registered as aliases)

### AuthController (`app/Http/Controllers/Api/V1/AuthController.php`)
- `register()` — creates company + admin user + default permissions + default chart of accounts in transaction, returns Sanctum token
- `login()` — validates credentials, checks is_active, returns token with abilities
- `logout()` — revokes current token
- `me()` — returns user + company + permissions
- `refreshToken()` — revokes old, issues new token with recalculated abilities

### Routes (`routes/api.php`) — ALL apiResource
```php
// Public
Route::post('v1/register', [AuthController::class, 'register']);
Route::post('v1/login', [AuthController::class, 'login']);

// Protected (auth:sanctum + active)
Route::prefix('v1')->middleware(['auth:sanctum', 'active'])->group(function () {
    // Auth
    Route::apiResource('auth', AuthController::class)->only(['index']); // GET /me
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh-token', [AuthController::class, 'refreshToken']);

    // Sync
    Route::apiResource('sync', SyncController::class);

    // Inventory (permission:inventory.view)
    Route::apiResources([
        'items'         => ItemController::class,
        'batches'       => BatchController::class,
        'godowns'       => GodownController::class,
        'stock-ledger'  => StockLedgerController::class,
    ]);

    // Purchase (permission:purchase.view)
    Route::apiResources([
        'parties'             => PartyController::class,
        'purchase-orders'     => PurchaseOrderController::class,
        'purchase-invoices'   => PurchaseInvoiceController::class,
        'purchase-returns'    => PurchaseReturnController::class,
    ]);

    // Sales (permission:sales.view)
    Route::apiResources([
        'sales-orders'       => SalesOrderController::class,
        'sales-invoices'     => SalesInvoiceController::class,
        'sales-returns'      => SalesReturnController::class,
        'payment-receipts'   => PaymentReceiptController::class,
    ]);

    // Accounting (permission:accounting.view)
    Route::apiResources([
        'chart-of-accounts' => ChartOfAccountController::class,
        'journal-entries'   => JournalEntryController::class,
        'financial-years'   => FinancialYearController::class,
    ]);

    // Admin (permission:settings.view)
    Route::apiResources([
        'branches'  => BranchController::class,
        'users'     => UserController::class,
    ]);
});
```
Permission checks handled inside each controller via `$this->authorize()` (Policy), not route middleware.

---

## Phase 6: Seeders
- **RolesAndPermissionsSeeder** — creates Spatie roles (admin, manager, accountant, salesman) and permissions (inventory.view, purchase.create, etc.), assigns permissions to roles
- **ChartOfAccountSeeder** — default Indian COA (Cash, Bank, AR, AP, GST Payable, Sales, Purchase, etc.)
- **DatabaseSeeder** — calls above + optional demo data in dev

---

## Build Order (execution sequence)
1. Install composer packages (sanctum, spatie/permission, spatie/activitylog)
2. Publish vendor assets (sanctum config, spatie migrations)
3. Create 3 traits (HasUuid, HasSyncColumns, BelongsToCompany)
4. Create migrations 1→24 in order (migration #4 is Spatie's published migration)
5. Create all 23 models (User uses Spatie's `HasRoles` trait)
6. Create 1 middleware file (EnsureUserIsActive)
7. Create AuthController
8. Create 12 policies (use `$user->hasPermissionTo()`)
9. Create routes/api.php (all apiResource)
10. Update bootstrap/app.php (routes + middleware aliases)
11. Create seeders (RolesAndPermissionsSeeder, ChartOfAccountSeeder)
12. Run `php artisan migrate` and `php artisan db:seed`

## Verification
- `php artisan migrate` runs without errors
- `php artisan route:list` shows all API routes
- `php artisan tinker` → `Company::create([...])` creates with UUID
- POST `/api/v1/register` returns a token
- POST `/api/v1/login` returns a token
- GET `/api/v1/me` (with Bearer token) returns user data
- Unauthorized access to module routes returns 403
