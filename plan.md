# Zazzy POS — Petpooja-style Restaurant POS
## Electron + React + Laravel (backend copied from ERP, refined for restaurant)

---

## Core Strategy

**Copy the entire ERP Laravel backend to `/Users/aashu/code/pos/api/`, then refine it for restaurant POS.**

- Start with `cp -r /Users/aashu/erp/api /Users/aashu/code/pos/api`
- Keep: accounting, auth, items, parties, stock ledger, sync engine, thermal printing, vouchers
- Remove: `POSController.php` (basic retail POS — replaced by full restaurant flow)
- Remove: payroll module, Tally import (not needed for restaurant)
- Add: floor plans, dining tables, KOT system, restaurant order flow, recipes
- `AccountingService::postSalesInvoice()` stays untouched — auto-vouchers still work

---

## What Stays vs What Changes in Copied Backend

### KEEP (zero changes)
| File | Reason |
|---|---|
| `app/Traits/HasUuid.php` | UUID PKs on all models |
| `app/Traits/HasSyncColumns.php` | Offline sync support |
| `app/Traits/BelongsToCompany.php` | Multi-tenant isolation |
| `app/Services/AccountingService.php` | Auto-vouchers (Dr/Cr) on every sale |
| `app/Services/ThermalTemplateRenderer.php` | Receipt printing |
| `app/Services/InvoicePdfService.php` | PDF bills |
| `app/Models/SalesInvoice.php` | Core billing model |
| `app/Models/SalesInvoiceLine.php` | Line items |
| `app/Models/Item.php` | Menu items (restaurant uses items as menu) |
| `app/Models/Party.php` | Customers + vendors |
| `app/Models/Voucher.php` + `VoucherLine.php` | Journal entries |
| `app/Models/Ledger.php` + `AccountingGroup.php` | Chart of accounts |
| `app/Models/StockLedger.php` | Inventory movements |
| `app/Models/PaymentReceipt.php` | Payment records |
| `app/Models/DocumentCounter.php` | Invoice/KOT number generation |
| `app/Models/FinancialYear.php` | Accounting periods |
| `app/Models/Company.php` + `Branch.php` | Outlet management |
| `app/Models/ThermalTemplate.php` | Receipt templates |
| `app/Http/Controllers/Api/V1/AuthController.php` | Login/logout |
| `app/Http/Controllers/Api/V1/SyncController.php` | Push/pull sync |
| `app/Http/Controllers/Api/V1/SalesInvoiceController.php` | Invoice CRUD + PDF |
| `app/Http/Controllers/Api/V1/ItemController.php` | Menu item CRUD |
| `app/Http/Controllers/Api/V1/PartyController.php` | Customer CRUD |
| `app/Http/Controllers/Api/V1/ReportController.php` | Reports (extend, don't rewrite) |
| All accounting controllers (Voucher, Ledger, etc.) | Accounting module |
| `database/migrations/*` (keep all existing) | Schema base |

### REMOVE after copy (tally + OCR only)
| File | Reason |
|---|---|
| `app/Http/Controllers/Api/V1/POSController.php` | Replaced by full restaurant flow |
| `app/Http/Controllers/Api/V1/TallyImportController.php` | Not needed for restaurant |
| `app/Http/Controllers/Api/V1/OcrController.php` | Not needed |
| `app/Services/TallyImportService.php` | Not needed |
| Tally + OCR routes from `routes/api.php` | Not needed |

### KEEP — Payroll (full module retained)
Restaurant pays kitchen staff, waiters, cashiers. All payroll controllers, services, and models stay:
`PayrollController`, `EmployeeController`, `DepartmentController`, `DesignationController`,
`PayrollService`, `Employee`, `Department`, `Designation`, `SalaryStructure`, `PayrollRun`, `PayrollEntry`, all payroll routes.

### ADD (new restaurant-specific files)
| New File | Purpose |
|---|---|
| `app/Models/FloorPlan.php` | Restaurant floor layout |
| `app/Models/DiningTable.php` | Individual tables with status |
| `app/Models/KitchenOrderTicket.php` | KOT header |
| `app/Models/KotLine.php` | Per-item KOT line |
| `app/Models/Recipe.php` | Menu item → ingredients mapping |
| `app/Models/RecipeIngredient.php` | Single ingredient in recipe |
| `app/Http/Controllers/Api/V1/RestaurantOrderController.php` | Full restaurant order lifecycle |
| `app/Http/Controllers/Api/V1/FloorPlanController.php` | Floor plan CRUD |
| `app/Http/Controllers/Api/V1/DiningTableController.php` | Table CRUD + status |
| `app/Http/Controllers/Api/V1/KotController.php` | KOT generation + status |
| `app/Http/Controllers/Api/V1/RecipeController.php` | Recipe management |
| `app/Services/RestaurantOrderService.php` | Order lifecycle, KOT creation |
| `app/Services/InventoryDeductionService.php` | Recipe-based stock deduction |

### MODIFY after copy
| File | Change |
|---|---|
| `database/migrations/..._create_sales_invoices_table.php` | Add `order_type`, `table_id`, `pax`, `kot_count` |
| `app/Models/SalesInvoice.php` | Add `order_type`, `table_id`, `pax`, relationships |
| `routes/api.php` | Remove only tally routes; add restaurant routes; keep payroll routes |
| `app/Services/AccountingService.php` | No change to auto-voucher logic |

---

## New Restaurant API Flow (replaces old POSController)

### Full Dine-In Order Lifecycle

```
1. POST /restaurant/orders
   { order_type: 'dine_in', table_id, pax, godown_id }
   → Creates SalesInvoice (status='draft', pos_held=false)
   → Updates DiningTable.status = 'occupied'
   → Returns { order_id, order_number }

2. POST /restaurant/orders/{id}/lines
   { lines: [{ item_id, quantity, rate, gst_rate, notes }] }
   → Adds SalesInvoiceLines with kot_status='pending'
   → Recalculates invoice totals

3. POST /restaurant/orders/{id}/kot
   → Takes all lines with kot_status='pending'
   → Creates KitchenOrderTicket + KotLines
   → Updates lines.kot_status = 'sent'
   → Increments SalesInvoice.kot_count
   → Returns KOT for printing

4. PATCH /restaurant/kots/{id}/status
   { status: 'in_progress' | 'ready' | 'served' }
   → Updates KOT status + individual KotLine statuses

5. POST /restaurant/orders/{id}/checkout
   { payments: [{ mode, amount, reference }], round_off }
   → Validates: all lines are KOT'd (kot_status != 'pending')
   → Creates PaymentReceipts
   → Calls AccountingService::postSalesInvoice() ← AUTO-VOUCHER
   → Calls AccountingService::postReceipt() per payment
   → Calls InventoryDeductionService::deductForOrder() ← STOCK
   → Updates SalesInvoice.status = 'confirmed'
   → Updates DiningTable.status = 'vacant'
   → Returns confirmed invoice

6. GET /restaurant/orders/{id}/invoice/html
   → ThermalTemplateRenderer::render() ← existing ERP service
```

### Takeaway Order (simplified — no table, no KOT mandatory)

```
POST /restaurant/orders              { order_type: 'takeaway' }
POST /restaurant/orders/{id}/lines   (add items)
POST /restaurant/orders/{id}/checkout (pay and done)
```

### Delivery Order

```
POST /restaurant/orders    { order_type: 'delivery', customer_id, delivery_address }
(same flow as takeaway + customer required)
```

---

## New Database Tables (add to existing ERP migrations)

```sql
-- floor_plans
id UUID PK, company_id UUID FK,
name VARCHAR(100), sort_order INT DEFAULT 0,
+ HasUuid, HasSyncColumns, BelongsToCompany

-- dining_tables
id UUID PK, company_id UUID FK, floor_plan_id UUID FK,
name VARCHAR(20), capacity TINYINT DEFAULT 4,
shape ENUM('square','round','rectangle') DEFAULT 'square',
pos_x SMALLINT DEFAULT 0, pos_y SMALLINT DEFAULT 0,
status ENUM('vacant','occupied','reserved','cleaning') DEFAULT 'vacant',
current_order_id CHAR(36) NULL,
is_active BOOL DEFAULT true,
+ sync columns

-- kots
id UUID PK, company_id UUID FK,
sales_invoice_id CHAR(36) NULL,  -- NULL until checkout assigns final invoice
order_session_id CHAR(36),       -- groups KOTs for one table visit
kot_number VARCHAR(20),          -- KOT-001, KOT-002 per session
status ENUM('new','in_progress','ready','served') DEFAULT 'new',
notes TEXT NULL, print_count TINYINT DEFAULT 0,
+ sync columns

-- kot_lines
id UUID PK, kot_id CHAR(36) FK,
item_id CHAR(36) FK, item_name VARCHAR(200),  -- snapshot
variant_name VARCHAR(100) NULL,
quantity DECIMAL(10,2), notes TEXT NULL,
status ENUM('pending','cooking','ready') DEFAULT 'pending'

-- recipes
id UUID PK, company_id UUID FK,
item_id CHAR(36) FK (menu item),
variant_label VARCHAR(100) NULL,
notes TEXT NULL,
+ HasUuid, BelongsToCompany

-- recipe_ingredients
id UUID PK, recipe_id CHAR(36) FK,
item_id CHAR(36) FK (the ingredient / raw material),
quantity DECIMAL(10,4), unit VARCHAR(20)

-- Extend sales_invoices (modify existing migration):
ADD order_type ENUM('dine_in','takeaway','delivery') DEFAULT 'takeaway' AFTER notes
ADD table_id CHAR(36) NULL                                               AFTER order_type
ADD pax SMALLINT DEFAULT 1                                               AFTER table_id
ADD kot_count TINYINT DEFAULT 0                                          AFTER pax
```

---

## Complete API Route Map (refined `routes/api.php`)

```php
// ── AUTH ────────────────────────────────────────────────
POST   /auth/login                                  [public]
POST   /auth/logout
GET    /auth/me
POST   /auth/refresh

// ── DEVICE REGISTRATION ─────────────────────────────────
POST   /devices/register
GET    /devices
DELETE /devices/{device}

// ── COMPANY / OUTLET ────────────────────────────────────
GET    /company
PUT    /company
GET    /branches
POST   /branches
PUT    /branches/{branch}

// ── MENU ITEMS (items table = menu in restaurant) ───────
GET    /items                       ?search= &item_group_id= &is_active=
POST   /items
GET    /items/{item}
PUT    /items/{item}
DELETE /items/{item}
GET    /item-groups
POST   /item-groups
PUT    /item-groups/{group}
DELETE /item-groups/{group}

// ── CUSTOMERS ───────────────────────────────────────────
GET    /parties                     ?type=customer &search=
POST   /parties
GET    /parties/{party}
PUT    /parties/{party}
GET    /parties/{party}/ledger      (outstanding balance)

// ── FLOOR PLANS + TABLES ────────────────────────────────
GET    /floor-plans
POST   /floor-plans
PUT    /floor-plans/{plan}
DELETE /floor-plans/{plan}
GET    /dining-tables               ?floor_plan_id=
POST   /dining-tables
PUT    /dining-tables/{table}
DELETE /dining-tables/{table}
PATCH  /dining-tables/{table}/status     { status }
POST   /dining-tables/merge              { primary_id, secondary_ids[] }
POST   /dining-tables/{table}/transfer   { target_table_id }

// ── RESTAURANT ORDERS (core flow) ───────────────────────
GET    /restaurant/orders           ?status= &date= &table_id=
POST   /restaurant/orders           { order_type, table_id?, pax?, godown_id, customer_id? }
GET    /restaurant/orders/{id}
PATCH  /restaurant/orders/{id}      { notes?, pax?, discount? }
DELETE /restaurant/orders/{id}      (cancel only if no KOT sent)

POST   /restaurant/orders/{id}/lines           { lines[] }
PUT    /restaurant/orders/{id}/lines/{line}    { quantity?, notes?, discount_percent? }
DELETE /restaurant/orders/{id}/lines/{line}    (cancel line)

POST   /restaurant/orders/{id}/hold            (park bill)
POST   /restaurant/orders/{id}/unhold          (resume parked bill)
POST   /restaurant/orders/{id}/split           { line_ids[] } → child order
POST   /restaurant/orders/{id}/transfer-table  { table_id }

POST   /restaurant/orders/{id}/checkout        { payments[], round_off? }
GET    /restaurant/orders/{id}/invoice/html    (thermal receipt HTML)
GET    /restaurant/orders/{id}/invoice/pdf     (PDF bill)

// ── KOT ─────────────────────────────────────────────────
POST   /restaurant/orders/{id}/kot             (generate KOT for pending lines)
GET    /kots                        ?status= &date= &outlet_id=
GET    /kots/{kot}
PATCH  /kots/{kot}/status           { status: in_progress|ready|served }
PATCH  /kots/{kot}/lines/{line}/status { status: cooking|ready }
POST   /kots/{kot}/reprint

// ── INVENTORY ───────────────────────────────────────────
GET    /stock-ledger                ?item_id= &date_from= &date_to=
POST   /stock-ledger/adjustment     { item_id, quantity, type, notes }
GET    /stock-summary               current stock levels

// ── RECIPES ─────────────────────────────────────────────
GET    /recipes                     ?item_id=
POST   /recipes
PUT    /recipes/{recipe}
DELETE /recipes/{recipe}

// ── VENDORS + PURCHASES ─────────────────────────────────
GET    /parties                     ?type=vendor   (reuse parties endpoint)
GET    /purchase-invoices           (vendor purchases for stock-in)
POST   /purchase-invoices
GET    /purchase-invoices/{id}

// ── ACCOUNTING (unchanged from ERP) ─────────────────────
GET    /accounting/groups
GET    /accounting/ledgers
POST   /accounting/vouchers
GET    /accounting/vouchers
GET    /reports/trial-balance
GET    /reports/profit-and-loss
GET    /reports/balance-sheet
GET    /reports/party-ledger

// ── NEW RESTAURANT REPORTS ──────────────────────────────
GET    /reports/pos-summary         ?date_from= &date_to=
GET    /reports/payment-modes       ?date=
GET    /reports/item-wise-sales     ?date_from= &date_to=
GET    /reports/day-close           ?date=
GET    /reports/kot-performance     ?date=
GET    /reports/gst-summary         ?month= &year=

// ── SETTINGS ────────────────────────────────────────────
GET    /company-settings
PUT    /company-settings
GET    /thermal-templates
POST   /thermal-templates
POST   /thermal-templates/load-defaults
GET    /financial-years
POST   /financial-years

// ── SYNC ────────────────────────────────────────────────
POST   /sync/push
GET    /sync/pull
GET    /sync/status
```

---

## Step-by-Step Build Plan (15 Steps)

---

### STEP 1 — Copy ERP Backend + Clean Up

**Goal:** `/Users/aashu/code/pos/api/` has the full ERP backend, cleaned up for restaurant use.

**Tasks:**
1. `cp -r /Users/aashu/erp/api /Users/aashu/code/pos/api`
2. Update `composer.json`: change app name to `zazzy/pos-api`
3. Fresh `.env` for POS (new MySQL DB: `zazzy_pos`, new APP_KEY)
4. **Delete 3 files only** (tally + OCR — payroll is fully kept):
   - `app/Http/Controllers/Api/V1/POSController.php` ← replaced by RestaurantOrderController
   - `app/Http/Controllers/Api/V1/TallyImportController.php`
   - `app/Http/Controllers/Api/V1/OcrController.php`
   - `app/Services/TallyImportService.php`
5. Clean up `routes/api.php`: remove tally/OCR/old-POS routes only. **Keep all payroll routes.**
6. Run `php artisan migrate:fresh --seed` → clean DB
7. Verify: `GET /api/health` returns `{ ok: true }`

**KEEP these existing ERP controllers untouched:**
`AuthController`, `CompanyController`, `BranchController`, `ItemController`, `ItemGroupController`, `PartyController`, `SalesInvoiceController`, `SyncController`, `ReportController`, `AccountingGroupController`, `LedgerController`, `VoucherController`, `PaymentReceiptController`, `ThermalTemplateController`, `FinancialYearController`, `DocumentCounterController`, `StockLedgerController`, `GodownController`, `UnitController`

---

### STEP 2 — Add Restaurant DB Tables + Models

**Goal:** New restaurant tables exist in DB; models have correct relationships.

**Modify existing migration** `..._create_sales_invoices_table.php`:
```php
$table->enum('order_type', ['dine_in','takeaway','delivery'])->default('takeaway')->after('notes');
$table->char('table_id', 36)->nullable()->after('order_type');
$table->smallInteger('pax')->default(1)->after('table_id');
$table->tinyInteger('kot_count')->default(0)->after('pax');
```

**Create new migrations** (in-place, no new files per CLAUDE.md — add as new `up()` blocks or use existing last migration):
- `create_floor_plans_table`
- `create_dining_tables_table`
- `create_kots_table`
- `create_kot_lines_table`
- `create_recipes_table`
- `create_recipe_ingredients_table`

**New Models** — all extend `Model` and use traits:
```php
// FloorPlan.php
use HasUuid, HasSyncColumns, BelongsToCompany;
protected $fillable = ['name', 'sort_order'];
public function tables() { return $this->hasMany(DiningTable::class); }

// DiningTable.php
use HasUuid, HasSyncColumns, BelongsToCompany;
protected $fillable = ['floor_plan_id','name','capacity','shape','pos_x','pos_y','status','current_order_id','is_active'];
protected $casts = ['is_active' => 'boolean'];
public function floorPlan() { return $this->belongsTo(FloorPlan::class); }
public function currentOrder() { return $this->belongsTo(SalesInvoice::class, 'current_order_id'); }

// KitchenOrderTicket.php
use HasUuid, HasSyncColumns, BelongsToCompany;
protected $fillable = ['sales_invoice_id','order_session_id','kot_number','status','notes','print_count'];
public function lines() { return $this->hasMany(KotLine::class, 'kot_id'); }
public function invoice() { return $this->belongsTo(SalesInvoice::class); }

// KotLine.php
use HasUuid;
protected $fillable = ['kot_id','item_id','item_name','variant_name','quantity','notes','status'];

// Recipe.php
use HasUuid, BelongsToCompany;
protected $fillable = ['item_id','variant_label','notes'];
public function ingredients() { return $this->hasMany(RecipeIngredient::class); }
public function item() { return $this->belongsTo(Item::class); }

// RecipeIngredient.php
use HasUuid;
protected $fillable = ['recipe_id','item_id','quantity','unit'];
public function stockItem() { return $this->belongsTo(Item::class, 'item_id'); }
```

**Extend `SalesInvoice.php`:**
```php
// Add to $fillable:
'order_type', 'table_id', 'pax', 'kot_count'

// Add relationship:
public function diningTable() { return $this->belongsTo(DiningTable::class, 'table_id'); }
public function kots() { return $this->hasMany(KitchenOrderTicket::class, 'sales_invoice_id'); }
```

Run `php artisan migrate:fresh --seed` to verify.

---

### STEP 3 — RestaurantOrderController (Core Order Flow)

**Goal:** Full order lifecycle: create → add items → KOT → checkout → auto-voucher.

**`app/Http/Controllers/Api/V1/RestaurantOrderController.php`**

Key methods (all wrapped in `DB::transaction()` where mutations occur):

**`store()`** — create new order:
```php
// Validate: order_type, godown_id, table_id (required if dine_in)
// Resolve party: use provided customer_id or find/create 'Walk-in Customer'
// Resolve financial year from today's date (same as ERP SalesInvoiceController)
// Create SalesInvoice: status='draft', pos_held=false, kot_count=0
// If dine_in: update DiningTable.status='occupied', current_order_id=invoice.id
// Return invoice
```

**`addLines()`** — add items to order:
```php
// Validate: lines[] with item_id, quantity, rate, gst_rate, notes
// Create SalesInvoiceLines with kot_status='pending'
// Recalculate invoice totals (same formula as old POSController)
// Return updated invoice with lines
```

**`checkout()`** — finalize and pay (calls same ERP services):
```php
DB::transaction(function() {
    // Validate: payments[] sum = grand_total (or post_payment=true)
    // Update SalesInvoice: status='confirmed', invoice_number (DocumentCounter)
    // Create StockLedger entries (if no recipe) or call InventoryDeductionService
    // AccountingService::postSalesInvoice($invoice)    ← AUTO-VOUCHER (unchanged)
    // foreach payment: PaymentReceipt + AccountingService::postReceipt()
    // If dine_in: DiningTable.status='vacant', current_order_id=null
    // Return confirmed invoice
})
```

**`generateKot()`** — send pending lines to kitchen:
```php
// Find lines with kot_status='pending'
// DocumentCounter for 'kot' → KOT-001, KOT-002...
// Create KitchenOrderTicket + KotLines (snapshot item names)
// Update lines.kot_status = 'sent'
// Increment SalesInvoice.kot_count
// Return KOT
```

**Other methods:** `hold()`, `unhold()`, `cancel()`, `split()`, `transferTable()`

---

### STEP 4 — Floor Plan & Table Controllers

**Goal:** CRUD for floor plans + tables; table status management.

**`FloorPlanController.php`** — standard apiResource (index, store, update, destroy)

**`DiningTableController.php`:**
- `index()` — return tables with current order (join to get order total + pax)
- `store()` / `update()` — CRUD with floor_plan_id
- `updateStatus()` — `PATCH /dining-tables/{id}/status` with validation
- `merge()` — `POST /dining-tables/merge` → moves all lines from secondary tables to primary order, marks secondaries as occupied with same order
- `transfer()` — `POST /dining-tables/{id}/transfer` → changes order's table_id, updates both table statuses

All use `BelongsToCompany` trait for automatic scoping.

---

### STEP 5 — KOT Controller

**Goal:** KOT status management for kitchen display integration.

**`KotController.php`:**
- `index()` — `GET /kots?status=new,in_progress&date=today` — for kitchen display polling
- `updateStatus()` — `PATCH /kots/{id}/status` — moves KOT between stages
- `updateLineStatus()` — `PATCH /kots/{id}/lines/{lid}/status` — item-level (cooking/ready)
- `reprint()` — `POST /kots/{id}/reprint` — returns KOT data formatted for thermal print

**Auto-status rule:** When all KotLines of a KOT are `status='ready'`, auto-update KOT to `'ready'` and broadcast to frontend (via response payload, not WebSocket).

---

### STEP 6 — Recipe Controller + Inventory Deduction Service

**Goal:** Recipe management + automatic ingredient deduction on checkout.

**`RecipeController.php`** — apiResource CRUD. Index filters by `item_id`. Store validates ingredients array.

**`app/Services/InventoryDeductionService.php`:**
```php
public function deductForOrder(SalesInvoice $invoice): void
{
    foreach ($invoice->lines as $line) {
        $recipe = Recipe::where('item_id', $line->item_id)
                        ->with('ingredients.stockItem')
                        ->first();
        if (!$recipe) continue;

        foreach ($recipe->ingredients as $ingredient) {
            $deductQty = $ingredient->quantity * $line->quantity;
            StockLedger::create([
                'company_id'     => $invoice->company_id,
                'item_id'        => $ingredient->item_id,
                'godown_id'      => $invoice->godown_id,
                'type'           => 'sale',
                'quantity'       => -$deductQty,
                'reference_type' => 'sales_invoice',
                'reference_id'   => $invoice->id,
                'notes'          => "Auto: recipe deduction for {$line->item_name}",
            ]);
        }
    }
}
```

Call `InventoryDeductionService::deductForOrder()` inside `RestaurantOrderController::checkout()` DB transaction, after invoice lines are saved.

---

### STEP 7 — Scaffold Electron App

**Goal:** Electron window opens; pings the new POS backend.

**Tasks:**
1. `cd /Users/aashu/code/pos && npm create @quick-start/electron electron-app --template react-ts`
2. Install dependencies:
   ```
   # Main process
   npm install better-sqlite3 electron-store node-thermal-printer electron-updater
   npm install -D @types/better-sqlite3

   # Renderer
   npm install axios @tanstack/react-query zustand react-router-dom
   npm install react-hook-form @hookform/resolvers zod
   npm install lucide-react react-hot-toast recharts qrcode.react
   npm install tailwind-merge clsx
   npm install -D tailwindcss @tailwindcss/vite electron-builder
   ```
3. Configure `electron.vite.config.ts` — main/preload/renderer split
4. Tailwind CSS — copy config from `/Users/aashu/erp/fe/tailwind.config.ts`
5. `src/preload/index.ts` — `contextBridge` exposing `window.electronAPI`
6. `src/main/index.ts` — BrowserWindow (1400×900), load `/setup` if no token, else `/pos/billing`
7. `src/renderer/src/api/client.ts` — **copy from** `/Users/aashu/erp/fe/src/lib/axios.ts`, change `baseURL` to read from `electron-store` key `serverUrl`
8. Verify: Electron opens, `/api/health` returns 200

---

### STEP 8 — Auth & Device Registration in Electron

**Goal:** Staff log in; device registers to a company.

**ERP auth endpoints reused:** `POST /auth/login`, `GET /auth/me`

**New endpoint** (add to POS `routes/api.php`):
```php
POST /devices/register  { device_name, device_uuid }
// Creates pos_devices record, returns { device_id, outlet_id? }
```

**`src/main/auth/TokenStore.ts`** — wraps `electron-store` with `safeStorage.encryptString()`:
```typescript
setToken(token: string): void
getToken(): string | null
clearToken(): void
```

**`Login.tsx`** — **copy from** `/Users/aashu/erp/fe/src/pages/auth/LoginPage.tsx`, adapt for Electron (no React Router redirect — use `ipcRenderer` to reload)

**`SetupWizard.tsx`** (first-run):
1. Server URL input → test connection → `GET /api/health`
2. Login form
3. Device name → `POST /devices/register` → store device_id

**`authStore.ts`** — **copy from** `/Users/aashu/erp/fe/src/store/authStore.ts`, add:
```typescript
deviceId: string | null
godownId: string | null
```

---

### STEP 9 — Local SQLite + Sync Engine

**Goal:** All data accessible offline from local SQLite; syncs every 30s.

**`src/main/db/database.ts`** — `better-sqlite3` singleton:
```typescript
import Database from 'better-sqlite3';
const db = new Database(path.join(app.getPath('userData'), 'zazzy-pos.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

**`src/main/db/schema.sql`** — mirrors cloud tables (same column names as ERP migrations):

```sql
CREATE TABLE device_config (key TEXT PRIMARY KEY, value TEXT);

-- Synced DOWN (read cache)
CREATE TABLE items (id TEXT PRIMARY KEY, company_id TEXT, name TEXT, sku TEXT,
  barcode TEXT, selling_price REAL, gst_rate REAL, item_group_id TEXT,
  is_active INTEGER DEFAULT 1, synced_at TEXT);

CREATE TABLE item_groups (id TEXT PRIMARY KEY, company_id TEXT, name TEXT, parent_id TEXT);
CREATE TABLE godowns (id TEXT PRIMARY KEY, company_id TEXT, name TEXT, is_default INTEGER);
CREATE TABLE floor_plans (id TEXT PRIMARY KEY, company_id TEXT, name TEXT, sort_order INTEGER, synced_at TEXT);
CREATE TABLE dining_tables (id TEXT PRIMARY KEY, company_id TEXT, floor_plan_id TEXT,
  name TEXT, capacity INTEGER, shape TEXT, pos_x INTEGER, pos_y INTEGER,
  status TEXT DEFAULT 'vacant', current_order_id TEXT, is_active INTEGER,
  sync_status TEXT DEFAULT 'synced', updated_at_local TEXT, synced_at TEXT);

-- Synced UP (created offline, pushed to server)
CREATE TABLE sales_invoices (
  id TEXT PRIMARY KEY, company_id TEXT, device_id TEXT,
  order_type TEXT DEFAULT 'takeaway', table_id TEXT, pax INTEGER DEFAULT 1,
  party_id TEXT, party_name TEXT, godown_id TEXT,
  invoice_number TEXT, invoice_date TEXT,
  status TEXT DEFAULT 'draft', pos_held INTEGER DEFAULT 0,
  subtotal REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
  taxable_amount REAL DEFAULT 0, cgst_total REAL DEFAULT 0,
  sgst_total REAL DEFAULT 0, grand_total REAL DEFAULT 0,
  round_off REAL DEFAULT 0, amount_paid REAL DEFAULT 0,
  balance_due REAL DEFAULT 0, kot_count INTEGER DEFAULT 0,
  is_inter_state INTEGER DEFAULT 0, notes TEXT,
  sync_status TEXT DEFAULT 'pending', updated_at_local TEXT,
  synced_at TEXT, created_at TEXT, updated_at TEXT);

CREATE TABLE sales_invoice_lines (
  id TEXT PRIMARY KEY, sales_invoice_id TEXT,
  item_id TEXT, item_name TEXT, quantity REAL, rate REAL,
  discount_percent REAL DEFAULT 0, gst_rate REAL DEFAULT 0,
  cgst REAL DEFAULT 0, sgst REAL DEFAULT 0,
  taxable_amount REAL DEFAULT 0, line_total REAL DEFAULT 0,
  kot_status TEXT DEFAULT 'pending', notes TEXT,
  sync_status TEXT DEFAULT 'pending');

CREATE TABLE kots (
  id TEXT PRIMARY KEY, company_id TEXT, sales_invoice_id TEXT,
  kot_number TEXT, status TEXT DEFAULT 'new',
  notes TEXT, print_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending', updated_at_local TEXT,
  synced_at TEXT, created_at TEXT);

CREATE TABLE kot_lines (
  id TEXT PRIMARY KEY, kot_id TEXT, item_id TEXT,
  item_name TEXT, variant_name TEXT, quantity REAL,
  notes TEXT, status TEXT DEFAULT 'pending');

CREATE TABLE pending_checkouts (
  id TEXT PRIMARY KEY, payload TEXT,
  created_at TEXT, attempts INTEGER DEFAULT 0);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT, record_id TEXT, operation TEXT,
  payload TEXT, created_at TEXT,
  attempts INTEGER DEFAULT 0, last_error TEXT);
```

**`src/main/sync/SyncEngine.ts`** — **translate** `/Users/aashu/erp/fe/src/lib/sync.ts` from Dexie to better-sqlite3:
- Replace `db.table('items').toArray()` → `db.prepare('SELECT * FROM items').all()`
- Replace `db.table('items').put(record)` → `db.prepare('INSERT OR REPLACE INTO items ...')`
- Same push/pull logic, same endpoint URLs

**`SyncScheduler.ts`** — `setInterval` 30s + `net.online` event immediate trigger

---

### STEP 10 — Item Grid & Cart System

**Goal:** Items visible; cart calculates GST correctly.

**`ItemRepository.ts`** (main process):
```typescript
searchItems(query: string, groupId?: string, companyId: string): POSItem[] {
  return db.prepare(`
    SELECT i.*, COALESCE(SUM(sl.quantity), 0) as current_stock
    FROM items i
    LEFT JOIN stock_ledger sl ON sl.item_id = i.id AND sl.godown_id = ?
    WHERE i.company_id = ? AND i.is_active = 1
      AND (i.name LIKE ? OR i.sku LIKE ? OR i.barcode = ?)
    GROUP BY i.id
    LIMIT 60
  `).all(godownId, companyId, `%${query}%`, `%${query}%`, query);
}
```

IPC: `ipcMain.handle('items:search', (_, args) => ItemRepository.searchItems(...))`

**`ItemGrid.tsx`** (renderer) — **copy from** `fe/src/pages/pos/POSItemSearch.tsx`:
- Category tabs on left (item_groups from SQLite)
- Product tile grid: name, price, food-type indicator
- Barcode scanner detection (< 100ms keystrokes + Enter)
- On click → `cartStore.addItem(item)`

**`cartStore.ts`** (Zustand) — new file following ERP store pattern:
- Cart lines with GST calculated per line
- **Copy `calcGST()`** from `fe/src/lib/utils.ts`
- Zustand `computed` values: subtotal, cgstTotal, sgstTotal, grandTotal, roundOff
- `addItem()`, `updateQty()`, `removeItem()`, `setNotes()`, `applyDiscount()`, `clearCart()`

**`Cart.tsx`** — **copy from** `fe/src/pages/pos/POSCart.tsx`:
- Right panel with qty spinners, inline discount, line totals
- Summary footer with GST breakdown

---

### STEP 11 — Table Management UI

**Goal:** Visual floor plan; selecting a table opens dine-in order.

**Sync:** `floor_plans` and `dining_tables` pulled DOWN from API on login.

**`TableSelection.tsx`** (renderer):
- Shown when order type is Dine-In
- Floor plan tabs at top
- Color-coded table grid:
  - Green `vacant` → click to start order
  - Red `occupied` → click to resume (loads existing order into cart)
  - Orange `reserved`
  - Grey `cleaning`/inactive
- Pax dialog when starting new dine-in

**`TableCard.tsx`:**
```
┌──────────┐
│   T4     │
│ 4 covers │
│ ₹840     │  ← current order total
│ 00:23    │  ← time since first KOT
└──────────┘
```

**`MergeTableModal.tsx`** — select tables to merge; calls `POST /dining-tables/merge`

**`cartStore.ts` additions:**
```typescript
orderType: 'dine_in' | 'takeaway' | 'delivery'
tableId: string | null
pax: number
setTable(tableId, pax): void
setOrderType(type): void
```

---

### STEP 12 — KOT System & Kitchen Display

**Goal:** Send items to kitchen; track cooking status in real time.

**Billing screen (`BillingScreen.tsx`):**
- For dine-in orders: primary button = **"Send to Kitchen"** (creates KOT)
- "Charge" button enabled only after at least one KOT is sent
- Cart items show badge: `pending` (grey) / `sent` (blue) / `cooking` (orange) / `ready` (green)

**"Send to Kitchen" flow:**
1. Renderer → IPC: `window.electronAPI.sendKot({ invoiceId, lines })`
2. Main process: if online → `POST /restaurant/orders/{id}/kot` → get KOT back
3. If offline → save KOT to local `kots` + `kot_lines` SQLite, `sync_status='pending'`
4. Print KOT via `KotPrinter.ts` to kitchen printer
5. Broadcast `kot:new` to KitchenWindow via IPC

**`KitchenWindow.ts`** (main process) — second BrowserWindow on second display:
```typescript
const kitchenWin = new BrowserWindow({ fullscreen: true });
kitchenWin.loadURL(`${RENDERER_URL}#/kitchen`);
// Receives: ipcMain broadcasts 'kot:new', 'kot:updated'
// Sends back: 'kot:line:ready', 'kot:ready'
```

**`KitchenDisplay.tsx`** (`/kitchen` route):
- Reads KOTs from local SQLite via IPC (works fully offline)
- 3-column kanban: **New** | **Cooking** | **Ready to Serve**
- `KOTCard.tsx`: table, KOT#, time elapsed, item list with checkboxes
- Staff marks items → updates local SQLite + queues sync
- When all items ready → `PATCH /kots/{id}/status` → `ready`
- Main window receives `table:status` IPC → shows "Ready to Serve" badge on table

---

### STEP 13 — Full Payment & Checkout

**Goal:** All payment modes work; auto-voucher created in accounting.

**`PaymentModal.tsx`** — **copy from** `fe/src/pages/pos/POSPaymentModal.tsx`:
- Cash: tendered + change calculation + quick ₹50/100/200/500/1000 buttons
- UPI: reference number + QR code display (`qrcode.react`)
- Card: amount + last 4 digits
- Split: add multiple payment rows
- Credit (Post): requires registered customer, `post_payment=true`

**Checkout IPC flow:**
1. User confirms payment → `window.electronAPI.checkout(payload)`
2. Main process: online → `POST /restaurant/orders/{id}/checkout`
3. ERP `RestaurantOrderController::checkout()` runs:
   - `AccountingService::postSalesInvoice()` ← **auto Dr/Cr voucher** (unchanged)
   - `AccountingService::postReceipt()` per payment ← **auto receipt voucher**
   - `InventoryDeductionService::deductForOrder()` ← recipe stock deduction
   - Updates table status → vacant
4. If offline: queue to `pending_checkouts`, replay when reconnected
5. On success: show invoice number + print receipt

**Vouchers auto-created (no extra code):**
```
SALES VOUCHER
Dr Walk-in Customer A/c   ₹1,180   (grand_total)
Cr Sales Account          ₹1,000   (taxable_amount)
Cr Output CGST 9%         ₹   90
Cr Output SGST 9%         ₹   90

RECEIPT VOUCHER
Dr Cash-in-Hand           ₹1,180
Cr Walk-in Customer A/c   ₹1,180
```

**`CustomerBar.tsx`** — **copy from** `fe/src/pages/pos/POSCustomerBar.tsx`  
**`HoldOrdersPanel.tsx`** — **copy from** `fe/src/pages/pos/POSHeldBills.tsx`  
**`ReprintPanel.tsx`** — **copy from** `fe/src/pages/pos/POSReprintPanel.tsx`

---

### STEP 14 — Reports & Day Close

**Goal:** Manager dashboard; GST summary; cash reconciliation.

**Add to `ReportController.php`** (in copied ERP):
```php
// GET /reports/pos-summary?date_from=&date_to=
public function posSummary(Request $request)
{
    $dateRange = $this->resolveDateRange($request);  // reuse existing ERP helper
    return SalesInvoice::where('status', 'confirmed')
        ->whereBetween('invoice_date', $dateRange)
        ->selectRaw('
            COUNT(*) as total_orders,
            SUM(grand_total) as total_revenue,
            AVG(grand_total) as avg_order_value,
            SUM(cgst_total) as total_cgst,
            SUM(sgst_total) as total_sgst,
            order_type
        ')
        ->groupBy('order_type')
        ->get();
}
```

**`SalesSummary.tsx`** (renderer):
- Date picker (default: today)
- KPIs row: total orders, revenue, avg order
- Hourly bar chart (recharts — same as ERP)
- Payment mode breakdown pie

**`DayClose.tsx`** (renderer):
- Opening cash + cash sales = expected cash
- Cashier enters actual count → shows discrepancy
- "Close Day" prints thermal shift report

**`GSTReport.tsx`** (renderer):
- Rate-wise totals: 0%, 5%, 12%, 18%
- CGST + SGST + IGST columns
- CSV export button

---

### STEP 15 — Thermal Printing, Settings & Packaging

**Goal:** Thermal receipts print; app ships as an installer.

**Receipt printing:**
- `GET /restaurant/orders/{id}/invoice/html` → ERP's `ThermalTemplateRenderer` (unchanged)
- Main process: fetch HTML with Bearer token → `node-thermal-printer` ESC/POS → printer
- KOT printing: separate template (table#, KOT#, item list, no prices)

**`PrinterSettings.tsx`:**
- `window.electronAPI.getPrinters()` → list system printers
- Select billing printer + KOT printer separately
- Paper width: 58mm / 80mm
- "Test Print" button

**`OutletSettings.tsx`:**
- Select branch + default godown from ERP API
- GST mode: composition (5% flat) / regular (per-item rate)

**`DeviceInfo.tsx`:**
- Sync status: last synced at, pending count
- Manual "Sync Now" button
- Server URL change + test

**Keyboard shortcuts:**
| Key | Action |
|---|---|
| `F2` | Focus search |
| `F4` | Switch order type |
| `F8` | Hold bill |
| `F10` | Open payment |
| `Ctrl+K` | Send KOT |
| `Ctrl+T` | Open table map |
| `Ctrl+H` | Held bills panel |

**`electron-builder.yml`:**
```yaml
appId: com.zazzy.pos
productName: Zazzy POS
win:
  target: nsis
mac:
  target: dmg
publish:
  provider: github  # auto-update source
```

---

## Files to Copy from ERP (Summary)

| Electron Renderer File | Copy From ERP |
|---|---|
| `renderer/src/api/client.ts` | `fe/src/lib/axios.ts` (change baseURL) |
| `renderer/src/api/pos.ts` | `fe/src/api/pos.ts` (update endpoints) |
| `renderer/src/store/authStore.ts` | `fe/src/store/authStore.ts` (add deviceId) |
| `renderer/src/store/themeStore.ts` | `fe/src/store/themeStore.ts` (verbatim) |
| `renderer/src/types/index.ts` | `fe/src/types/index.ts` (extend with restaurant types) |
| `renderer/src/lib/utils.ts` | `fe/src/lib/utils.ts` (verbatim — includes calcGST) |
| `components/pos/Cart.tsx` | `fe/src/pages/pos/POSCart.tsx` |
| `components/pos/PaymentModal.tsx` | `fe/src/pages/pos/POSPaymentModal.tsx` |
| `components/pos/ItemSearch.tsx` | `fe/src/pages/pos/POSItemSearch.tsx` |
| `components/pos/CustomerBar.tsx` | `fe/src/pages/pos/POSCustomerBar.tsx` |
| `components/pos/HoldOrdersPanel.tsx` | `fe/src/pages/pos/POSHeldBills.tsx` |
| `components/pos/ReprintPanel.tsx` | `fe/src/pages/pos/POSReprintPanel.tsx` |

| POS Backend File | Source |
|---|---|
| `app/Traits/HasUuid.php` | Copied from ERP (verbatim) |
| `app/Traits/HasSyncColumns.php` | Copied from ERP (verbatim) |
| `app/Traits/BelongsToCompany.php` | Copied from ERP (verbatim) |
| `app/Services/AccountingService.php` | Copied from ERP (no changes) |
| `app/Services/ThermalTemplateRenderer.php` | Copied from ERP (no changes) |
| `app/Services/InvoicePdfService.php` | Copied from ERP (no changes) |
| All existing controllers (except POS/Payroll/Tally) | Copied from ERP (no changes) |

---

## Step Completion Checklist

- [ ] **Step 1** — ERP backend copied to `/pos/api/`, cleaned, migrated fresh, `/api/health` returns 200
- [ ] **Step 2** — Restaurant tables in DB: floor_plans, dining_tables, kots, recipes; models with relationships
- [ ] **Step 3** — `RestaurantOrderController` handles create/addLines/checkout; auto-voucher fires on checkout
- [ ] **Step 4** — Floor plan + table CRUD endpoints; status update + merge/transfer work
- [ ] **Step 5** — KOT endpoint generates ticket; status updates propagate to lines
- [ ] **Step 6** — Recipe CRUD; `InventoryDeductionService` deducts stock on checkout
- [ ] **Step 7** — Electron app opens, pings backend, shows "connected"
- [ ] **Step 8** — Login works, device registered, token stored encrypted, `/auth/me` succeeds on restart
- [ ] **Step 9** — SQLite schema created; sync engine pulls items from backend into local DB
- [ ] **Step 10** — Item grid renders from local SQLite; cart adds items with correct GST split
- [ ] **Step 11** — Floor plan visible; selecting table T1 creates dine-in order; table turns red
- [ ] **Step 12** — "Send to Kitchen" generates KOT, prints to kitchen printer, appears on kitchen screen
- [ ] **Step 13** — Full cash/UPI/card/split/credit checkout; voucher created in accounting; table turns green
- [ ] **Step 14** — Day-close report shows orders + GST breakdown; cash reconciliation works
- [ ] **Step 15** — Windows NSIS installer built and installs cleanly; auto-update detects new version
