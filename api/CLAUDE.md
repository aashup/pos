# API Backend Structure (Laravel 11)

## Directory Layout

```
api/
├── app/
│   ├── Http/Controllers/Api/V1/   # All API controllers
│   ├── Models/                     # Eloquent models (27+)
│   ├── Observers/                  # PartyObserver, CompanyObserver
│   ├── Policies/                   # Authorization (17 policies)
│   ├── Services/                   # AccountingService, InvoicePdfService
│   ├── Traits/                     # HasUuid, HasSyncColumns, BelongsToCompany, FiltersByFinancialYear
│   └── Helpers/
├── database/
│   ├── migrations/                 # Ordered by dependency (31 files)
│   └── seeders/
└── routes/api.php                  # All routes under /api/v1
```

## Key Traits (used by all models)

- **HasUuid** — auto UUID on create, sets incrementing=false, keyType='string'
- **HasSyncColumns** — adds sync_status/device_id/synced_at to fillable; scopes: pending(), synced(), conflicts()
- **BelongsToCompany** — auto-sets company_id from auth user on creating; global scope filters by company
- **FiltersByFinancialYear** — controller utility to apply FY date filters

## Accounting Architecture

### Groups vs Ledgers vs Vouchers
- **AccountingGroup** (`accounting_groups`) = Hierarchical classification only (folders). Has parent_id self-reference, system_key for well-known groups (sundry_debtors, sundry_creditors, bank_account, cash_account, etc.)
- **Ledger** (`ledgers`) = Individual accounts under groups. Has group_id FK to accounting_groups, system_key for well-known ledgers (cash, input_cgst, output_cgst, sales_account, purchase_account, etc.), polymorphic ledgerable for linking to Party.
- **VoucherLine** (`voucher_lines`) = Transaction lines referencing ledger_id (FK to ledgers).
- **Voucher** (`vouchers`) = Transaction header. Types: purchase, sales, payment, receipt, journal, contra. Append-only (no delete, only reversals).

### System Keys
Groups: sundry_debtors, sundry_creditors, cash_account, bank_account, sales_account, purchase_account, input_cgst/sgst/igst, output_cgst/sgst/igst
Ledgers: cash, input_cgst, input_sgst, input_igst, output_cgst, output_sgst, output_igst, sales_account, purchase_account, capital_account, stock

### Party → Ledger Auto-Creation (PartyObserver)
- type='customer' → 1 Ledger under Sundry Debtors → party.debtor_ledger_id
- type='vendor' → 1 Ledger under Sundry Creditors → party.creditor_ledger_id
- type='both' → 2 Ledgers: "{name} (Buyer)" under Sundry Debtors + "{name} (Vendor)" under Sundry Creditors

### AccountingService
- `postSalesInvoice()` — Dr: party debtor_ledger, Cr: sales + GST output ledgers
- `postPurchaseInvoice()` — Dr: purchase + GST input ledgers, Cr: party creditor_ledger
- `postPayment()` — Dr: party creditor_ledger, Cr: cash/bank ledger
- `postReceipt()` — Dr: cash/bank ledger, Cr: party debtor_ledger
- `postPayroll(PayrollRun $run, string $userId)` — Dr: Salary Expense (gross + employer PF + ESI), Cr: Salary Payable (net + TDS), PF Payable (employee + employer), ESI Payable (employee + employer), PT Payable
- Uses `Ledger::findBySystemKey()` for system accounts

### Payroll System Keys (added to DefaultGroupsService)
Ledgers: `salary_expense` (Direct Expenses, code 5100), `salary_payable` (Current Liabilities), `pf_payable` (Duties & Taxes), `esi_payable` (Duties & Taxes), `pt_payable` (Duties & Taxes)

### Voucher Types
Types: purchase, sales, payment, receipt, journal, contra, **payroll** (prefix: `PRL`)

## API Routes (all under /api/v1, auth:sanctum)

| Resource | Controller | Notes |
|----------|-----------|-------|
| POST /register, /login | AuthController | Public |
| apiResource parties | PartyController | Full CRUD |
| apiResource items | ItemController | Full CRUD |
| apiResource branches | BranchController | Full CRUD |
| apiResource godowns | GodownController | Full CRUD |
| apiResource purchase-orders | PurchaseOrderController | + PATCH status |
| apiResource purchase-invoices | PurchaseInvoiceController | |
| apiResource sales-orders | SalesOrderController | + PATCH status |
| apiResource sales-invoices | SalesInvoiceController | + PDF/HTML, PATCH status |
| apiResource accounting-groups | AccountingGroupController | + POST load-defaults |
| apiResource ledgers | LedgerController | Full CRUD |
| apiResource vouchers | VoucherController | Create/Read only (append-only) |
| apiResource payment-receipts | PaymentReceiptController | Create/Read/Delete |
| apiResource financial-years | FinancialYearController | + PATCH set-current |
| GET reports/* | ReportController | trial-balance, profit-and-loss, party-ledger |
| apiResource departments | DepartmentController | Full CRUD |
| apiResource designations | DesignationController | Full CRUD |
| apiResource employees | EmployeeController | CRUD + GET salary-structure, POST salary-structure |
| apiResource salary-structures | SalaryStructureController | show/update/destroy only |
| GET/POST/DELETE/PATCH payroll-runs | PayrollController | generate, show, destroy, approve, mark-paid, payslip |

## Controller Pattern
- Extends base Controller (AuthorizesRequests, ValidatesRequests)
- Uses `$this->authorize()` for policy-based auth
- Validation inline in controller methods
- Returns JSON: `response()->json(['data' => $resource])` or paginated collection

## Migration Order (key tables)
1. companies → 2. users → 3. branches → 4. financial_years → 5. accounting_groups → 6. ledgers → 7. parties → 8. items → 9. batches → 10. godowns → 11. stock_ledger → 12-16. purchase_* → 17-21. sales_* → 22. payment_receipts → 23. vouchers + voucher_lines → 24. payroll tables (in `2026_04_11_create_document_counters_table.php`)

## Financial Year Linking on Documents

`purchase_orders`, `sales_orders`, and `sales_invoices` all carry a `financial_year_id` nullable FK → `financial_years`.

### Resolution rule (all three controllers)
FY is **always resolved server-side from the document date** — the frontend never sends it. Pattern used in `store()`:

```php
$fy = FinancialYear::where('company_id', $user->company_id)
    ->whereDate('start_date', '<=', $validated['document_date'])
    ->whereDate('end_date',   '>=', $validated['document_date'])
    ->first();
// throws 422 if no FY matches
$validated['financial_year_id'] = $fy->id;
```

### Backfill on confirm
`updateStatus()` (PO, SO, SI) backfills `financial_year_id` when transitioning to `confirmed` if the column is null (handles records created before this column existed).

### SalesInvoice `update()`
Re-resolves FY when `invoice_date` changes and saves it.

### Models
`PurchaseOrder`, `SalesOrder`, `SalesInvoice` all have `financial_year_id` in `$fillable` and a `financialYear()` belongs-to relationship.

## Important Design Rules
- UUID primary keys everywhere
- Stock ledger & vouchers are append-only (no soft deletes, no edits)
- Double-entry accounting: every voucher must balance (total debit = total credit)
- All tables have sync columns for offline-first mobile support
- `loadDefaults()` is one-time operation tracked in CompanySetting

## Tally Import Module

### Files
- `app/Http/Controllers/Api/V1/TallyImportController.php` — 7 endpoints
- `app/Services/TallyImportService.php` — XML + ODBC fetch, parse, import logic

### Routes (`/tally` prefix, auth:sanctum)
| Method | Path | Purpose |
|--------|------|---------|
| GET | tally/test-connection | Test XML over HTTP (5s timeout) |
| GET | tally/test-odbc-connection | Test ODBC driver connection |
| GET | tally/fetch-ledgers?connection_method=xml\|odbc | Preview ledgers |
| POST | tally/import-ledgers | Import ledgers/parties |
| GET | tally/fetch-stock-items?connection_method=xml\|odbc | Preview stock items |
| POST | tally/import-stock-items | Import stock items |
| POST | tally/import-vouchers | Import Day Book vouchers |

### Connection Methods
- **XML over HTTP**: POST XML envelopes to `http://<host>:9000` — no driver needed, works over LAN
- **ODBC Direct**: `odbc_connect()` with `{Tally ODBC Driver}` (fallback: `{Tally Prime ODBC Driver}`); requires `php-odbc` extension + Tally ODBC driver on PHP server

### TallyImportService Key Methods
- `buildXmlRequest(reportName, staticVars)` — constructs Tally XML envelope
- `postToTally(url, xml)` — HTTP POST with 30s timeout; throws `RuntimeException` on non-2xx
- `fetchLedgers(url)` / `fetchLedgersOdbc(url)` — returns `TallyLedgerPreview[]`
- `fetchStockItems(url)` / `fetchStockItemsOdbc(url)` — returns `TallyStockItemPreview[]`
- `fetchVouchers(url, from, to)` / `fetchVouchersOdbc(url, from, to)` — returns parsed voucher array
- `parseLedgersXml(xml)` / `parseStockItemsXml(xml)` / `parseVouchersXml(xml)` — for file upload mode
- `importLedgers(companyId, userId, ledgers)` — shared by both methods; Party + Ledger creation
- `importStockItems(companyId, userId, items)` — creates ItemGroup + Unit if missing, then Item
- `importVouchers(companyId, userId, vouchers)` — creates Voucher + VoucherLines; validates double-entry balance
- `groupOdbcVoucherRows(rows)` — groups flat ODBC rows by `Date||VoucherNumber` into multi-line vouchers

### Import Rules
- **Party/Ledger/Item**: skip silently if same name already exists (case-insensitive, per company)
- **Voucher**: always create — no dedup (every Tally voucher becomes a new ERP voucher)
- **ItemGroup/Unit**: create if missing, not an error
- **PartyObserver**: creating a `Party` auto-creates accounting ledger — Default Account Groups must be loaded first
- **Double-entry validation**: `abs(totalDebit - totalCredit) <= 0.02`; fails voucher if unbalanced
- **Voucher numbering**: reuses `CompanySetting::getAndIncrementVoucherIndex()` + `Voucher::getTypePrefix()` with `source='tally_import'`

### ImportResult shape
```php
['created' => int, 'skipped' => int, 'failed' => int, 'errors' => [['entity','name','reason']], 'created_names' => string[]]
```

### Tally XML Report Names
- Test connection / companies: `List of Companies`
- Ledgers: `List of Ledgers`
- Stock Items: `List of Stock Items`
- Vouchers: `Day Book` (with `SVFROMDATE`/`SVTODATE` in `YYYYMMDD` format)

### ODBC SQL Queries
- Ledgers: `SELECT Name, Parent, OpeningBalance, GSTRegistrationNumber, LedMobile, Email FROM Ledger`
- Stock Items: `SELECT Name, Parent, BaseUnits, HSNCode, GSTRate FROM StockItem`
- Vouchers: `SELECT Date, VoucherType, VoucherNumber, Narration, LedgerName, Amount FROM DayBook WHERE Date >= '{from}' AND Date <= '{to}'`

### Tally Sign Convention
- XML opening balance: `"50000.00 Dr"` / `"50000.00 Cr"` string format
- ODBC amount: negative = credit, positive = debit

## Payroll Module

### Database Tables
- `departments` — company_id, name, is_active; soft-deletes
- `designations` — company_id, department_id (nullable FK), name, is_active; soft-deletes
- `employees` — full employee master: personal info, bank details, PF/ESI flags, department/designation FKs; soft-deletes
- `salary_structures` — employee_id, effective_from, Basic/HRA/DA/Conveyance/Medical/Special Allowance, PT (fixed), TDS (fixed), `custom_components` JSON, is_active; no soft-deletes
- `payroll_runs` — company_id, month, year, working_days, status (draft/approved/paid), totals, voucher_id FK; UNIQUE(company_id, month, year); soft-deletes
- `payroll_entries` — payroll_run_id, employee_id, present_days, all earning components, deductions, net_salary, employer PF/ESI, `custom_components` JSON; no BelongsToCompany, no soft-deletes
- `salary_component_definitions` — company_id, name, type (earning|deduction), is_active; BelongsToCompany, HasUuid, HasSyncColumns, SoftDeletes; managed from **Settings → Payroll**

### Custom Salary Components
Company-level custom earning/deduction headers (e.g. "Transport Allowance", "Canteen Deduction").

**Immutability guarantee:** When a payroll run is generated, `PayrollService` snapshots each component's name + pro-rated amount into `payroll_entries.custom_components` JSON. Payslip renders from the snapshot — renaming or deleting a definition never alters past payslips.

**JSON format** (same shape for `salary_structures.custom_components` and `payroll_entries.custom_components`):
```json
[{ "definition_id": "uuid", "name": "Transport Allowance", "type": "earning", "amount": 2000.00 }]
```

**Pro-rata rule in PayrollService:**
- `type = "earning"` → pro-rated: `amount × (present_days / working_days)` → added to gross
- `type = "deduction"` → fixed (like PT/TDS) → added to total_deductions

**Controller:** `SalaryComponentDefinitionController` — `index` (supports `?type=`, `?active_only=true`), `store`, `update`, `destroy` (soft-delete). Inline permission checks (`payroll.create/edit/delete`).

**Route:** `Route::apiResource('salary-component-definitions', ...)->only(['index','store','update','destroy']);`

### Salary Distribution (company_settings)
Admin sets % split for each earning component (fixed + custom) that must total 100%.
Stored as `salary_distribution_percentages` key in `company_settings` table (JSON string).
Keys: fixed earning names (`basic`, `hra`, `da`, `conveyance`, `medical`, `special_allowance`) + custom definition UUIDs.
Used by `SalaryStructureModal` on the frontend to auto-fill amounts when a total gross salary is entered.

### Models
- `Department`, `Designation`, `Employee`, `SalaryStructure`, `SalaryComponentDefinition` — use BelongsToCompany, HasUuid, HasSyncColumns
- `Employee` — `salaryStructure()` = `hasOne(SalaryStructure)->where('is_active',true)->latestOfMany('effective_from')`
- `SalaryStructure` — `custom_components` cast to array; `getGrossAttribute()` sums earning-type custom components
- `PayrollRun` — has SoftDeletes; relationships to entries, voucher, approvedBy
- `PayrollEntry` — HasUuid + HasSyncColumns only (no BelongsToCompany); `custom_components` cast to array

### PayrollService
- `generate(companyId, month, year, workingDays)` — creates draft run; present_days defaults to working_days; pro-rata = component × (present_days / working_days); snapshots custom_components
- `recomputeEntry(entry, presentDays, workingDays)` — recalculates all fields after attendance edit; re-pro-rates custom earning components
- `recalculateTotals(run)` — sums all entries back to run totals
- **Indian statutory rules**: PF employee = 12% basic, PF employer = 13% basic; ESI employee = 0.75% gross (only if gross ≤ Rs.21,000), ESI employer = 3.25% gross

### Policies
- `EmployeePolicy`, `PayrollPolicy` — both use `payroll.view/create/edit/delete` permissions
- `PayrollRun` model is bound to `PayrollPolicy` via `Gate::policy()` in `AppServiceProvider`

### Payslip PDF
- Route: `GET /payroll-runs/{id}/payslip/{employeeId}` → DomPDF download (`barryvdh/laravel-dompdf` v3.1)
- Blade template: `resources/views/payroll/payslip.blade.php`
- Sections: company header, employee info, attendance, earnings table (incl. custom earnings), deductions table (incl. custom deductions), net salary, employer contributions
- **⚠️ Do NOT use the literal ₹ character in the blade template** — DejaVu Sans Regular (dompdf default font) lacks the glyph; use `Rs.` instead. Bold weight has the glyph but Regular does not.
- **⚠️ Never write `@endif@if` on the same line without whitespace** — Blade's regex compiler skips the `@if`, compiling only the `@endif`, causing a PHP `unexpected token "endif"` parse error. Always put `@if` on a new line after `@endif`.
- After editing the blade template always run `php artisan view:clear` inside the Docker container: `docker compose exec api php artisan view:clear`

### ⚠️ RolePermissionSeeder — Cache Flush Required
When adding new modules to `$modules` array in `RolePermissionSeeder.php`, always call:
```php
app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
```
**before** the `syncPermissions()` calls. Without this, newly created permissions are invisible to `Permission::all()` due to Spatie's internal cache, and roles get no permissions for the new module.

### Role Permission Matrix
| Role | Payroll Permissions |
|------|-------------------|
| admin | view, create, edit, delete |
| manager | view, create, edit |
| accountant | view |
| salesman | none |

## Roles & Permissions — UUID Primary Keys

The `permissions` and `roles` tables use **`uuid` as PRIMARY KEY** — no integer `id` column.
- Defined in `2026_03_23_171617_create_permission_tables.php`
- Both `App\Models\Permission` and `App\Models\Role` extend Spatie models with `$primaryKey = 'uuid'` + `HasUuid` trait
- Route model binding resolves by UUID value
- API validation: `'permissions.*' => 'exists:permissions,uuid'` — expects flat array of UUID strings
- `Permission::whereIn('uuid', $uuids)->get()` to load permissions by UUID
- JSON response includes `uuid` field (NOT `id`) — frontend must use `perm.uuid` / `role.uuid`

**Auth response** includes `permissions: string[]` (flat array of permission names like `'inventory.view'`):
- Returned in `login`, `register`, and `me` responses
- Stored in `user.permissions` in Zustand auth store
- Used by `usePermissions()` hook for menu filtering

### ⚠️ Critical: Spatie Permission Methods

Always use `getAllPermissions()` when returning user permissions — NOT `getPermissionNames()`.

```php
// ✅ CORRECT — includes permissions assigned via the user's ROLE
$user->getAllPermissions()->pluck('name')->toArray()

// ❌ WRONG — returns DIRECT permissions only (empty for role-based users like salesman)
$user->getPermissionNames()->toArray()
```

**Why:** `UserSeeder` assigns permissions to *roles* (e.g. `$salesman->syncPermissions(...)`), not directly to users. `getPermissionNames()` only returns direct permissions → returns `[]` for all role-based users → frontend shows no menu items (or shows all via fallback).

`getAllPermissions()` = direct permissions + permissions via roles (what you always want).

---

## Zazzy POS Restaurant Module

Restaurant POS controllers are added alongside ERP controllers. The electron app at `/Users/aashu/code/pos/electron-app` connects to this same API.

### Restaurant-Specific Controllers

```
app/Http/Controllers/Api/V1/
├── RestaurantOrderController.php   # order lifecycle
├── RestaurantReportController.php  # 5 POS report endpoints
├── KotController.php               # kitchen display
├── FloorPlanController.php         # floor plan CRUD
└── DiningTableController.php       # dining tables
```

### Routes Added in `routes/api.php`

⚠️ **Restaurant report routes MUST appear before ERP report routes** (routes/api.php lines 217–222).

```php
// Floor plans & tables
Route::apiResource('floor-plans', FloorPlanController::class);
Route::apiResource('dining-tables', DiningTableController::class);
Route::patch('dining-tables/{dining_table}/status', [DiningTableController::class, 'updateStatus']);
Route::post('dining-tables/{dining_table}/merge', [DiningTableController::class, 'merge']);

// Restaurant orders (11 routes)
Route::get('restaurant/orders', [RestaurantOrderController::class, 'index']);
Route::post('restaurant/orders', [RestaurantOrderController::class, 'store']);
Route::get('restaurant/orders/{order}', [RestaurantOrderController::class, 'show']);
Route::post('restaurant/orders/{order}/lines', [RestaurantOrderController::class, 'addLines']);
Route::delete('restaurant/orders/{order}/lines/{line}', [RestaurantOrderController::class, 'removeLine']);
Route::post('restaurant/orders/{order}/kot', [RestaurantOrderController::class, 'generateKot']);
Route::post('restaurant/orders/{order}/checkout', [RestaurantOrderController::class, 'checkout']);
Route::post('restaurant/orders/{order}/hold', [RestaurantOrderController::class, 'hold']);
Route::post('restaurant/orders/{order}/unhold', [RestaurantOrderController::class, 'unhold']);
Route::post('restaurant/orders/{order}/cancel', [RestaurantOrderController::class, 'cancel']);
Route::post('restaurant/orders/{order}/transfer-table', [RestaurantOrderController::class, 'transferTable']);

// KOTs (kitchen display)
Route::get('kots', [KotController::class, 'index']);
Route::get('kots/{kot}', [KotController::class, 'show']);
Route::patch('kots/{kot}/status', [KotController::class, 'updateStatus']);
Route::patch('kots/{kot}/lines/{line}/status', [KotController::class, 'updateLineStatus']);
Route::post('kots/{kot}/reprint', [KotController::class, 'reprint']);

// Restaurant reports (BEFORE ERP reports)
Route::get('reports/sales-summary', [RestaurantReportController::class, 'salesSummary']);
Route::get('reports/item-wise', [RestaurantReportController::class, 'itemWise']);
Route::get('reports/day-close', [RestaurantReportController::class, 'dayClose']);
Route::get('reports/gst-summary', [RestaurantReportController::class, 'gstSummary']);
Route::get('reports/payment-mode', [RestaurantReportController::class, 'paymentMode']);
```

### Checkout Flow (`RestaurantOrderController@checkout`)

1. Resolve `FinancialYear` from `invoice_date` (throws 422 if none configured)
2. `DocumentCounter::next('POS', company_id)` → `POS-20240115-001`
3. Validate split payment: `payment_mode='split'`, `split_payments[]`
4. Store: single mode → `pos_payment_mode='cash'`; split → `pos_payment_mode='cash+upi'`
5. `InventoryDeductionService::deductForOrder($invoice)` — recipe-based stock deduction
6. `AccountingService::postPOSSale($invoice)` — journal entries
7. Release table: `DiningTable status='vacant', current_order_id=null`

### POS-Specific Columns Added to ERP Models

`SalesInvoice`: `order_type` (takeaway/dine_in/delivery), `table_id` FK, `pos_held` boolean, `pos_payment_mode` string
`SalesInvoiceLine`: `kot_status` (pending/sent/cooking/ready/served)
`DiningTable`: `status` (vacant/occupied/reserved/cleaning), `current_order_id` FK, `pos_x`, `pos_y`

### Services Used by POS

**`InventoryDeductionService@deductForOrder`**: looks up recipes for each invoice line, decrements `stock_items.current_stock`, creates `StockLedger` entries (type='out').

**`AccountingService@postPOSSale`**: creates balanced journal voucher; Dr: cash/bank/receivable ledger; Cr: sales + GST output ledgers.

### Sync Endpoints (for electron app PullWorker)

```
POST /api/v1/sync/push     receive pending records
GET  /api/v1/sync/pull     changes since ?since= timestamp
GET  /api/v1/sync/status
```

Pull returns item_groups, items, floor_plans, dining_tables, godowns.
