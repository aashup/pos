# Plan: Mobile App Feature Parity with Electron Desktop POS

## Context

The Zazzy POS Electron desktop app has a rich, complete feature set. The React Native mobile app (`mobile-app/`) currently covers only the core waitstaff workflow: table selection → billing → basic checkout. This plan brings the mobile app to full feature parity with the desktop.

### Core Architecture Requirement: Three-Layer Data Control

Every feature must follow this strict pattern — no exceptions:

```
Layer 1: State     → Zustand (in-memory, real-time UI state)
Layer 2: Local DB  → WatermelonDB (offline-first persistence, always the READ source)
Layer 3: Master DB → Laravel API (source of truth, sync target)
```

**Rules:**
- All UI reads from WatermelonDB — never directly from API cache
- All mutations write to WatermelonDB first (`sync_status='pending'`), then fire-and-forget push to API
- API pull syncs upsert into WatermelonDB; skip any row where local `sync_status='pending'`
- Reports are computed from WatermelonDB aggregations (offline-capable), with a sync pull triggered before computation
- Inventory CRUD writes to WatermelonDB first, pushes to API in background

---

## Gap Summary

| Feature Area | Desktop | Mobile Now | After Plan |
|---|---|---|---|
| GST calculation + split tax | ✅ | ❌ | ✅ |
| Variant / modifier selection | ✅ | ❌ | ✅ |
| Chef notes per KOT line | ✅ | ❌ | ✅ |
| Order type (dine_in/takeaway/delivery) | ✅ | ❌ | ✅ |
| Payment modal (cash/upi/card/credit + split) | ✅ | ❌ | ✅ |
| Occupied table resume | ✅ | ❌ | ✅ |
| Hold Orders screen + resume | ✅ | ❌ | ✅ |
| Order Detail (view/cancel/reprint) | ✅ | ❌ | ✅ |
| Kitchen Display KOT kanban | ✅ | ❌ | ✅ |
| Sales Summary report | ✅ | ❌ | ✅ |
| Day Close report | ✅ | ❌ | ✅ |
| Item-wise report | ✅ | ❌ | ✅ |
| GST Report | ✅ | ❌ | ✅ |
| Item list + CRUD | ✅ | ❌ | ✅ |
| Item variants management | ✅ | ❌ | ✅ |
| Modifier group management | ✅ | ❌ | ✅ |
| Combo management | ✅ | ❌ | ✅ |
| Device info / sync status | ✅ | partial | ✅ |
| Periodic background sync | ✅ (30 min) | ❌ | ✅ |

---

## Phase 1 — WatermelonDB Schema Upgrade (v1 → v2)

**Files:** `src/db/schema.ts`, `src/db/migrations.ts` (new), all model files

The schema must be expanded to hold **all** reference data so every screen reads from WatermelonDB, never raw API.

### Modified tables

**`items`** — add:
- `gst_rate` number, optional
- `unit` string, optional
- `has_variants` boolean
- `has_modifiers` boolean
- `sku` string, optional
- `cgst_pct` number, optional
- `sgst_pct` number, optional

**`orders`** — add:
- `order_type` string (dine_in | takeaway | delivery)
- `payment_mode` string, optional
- `amount_paid` number, optional
- `amount_tendered` number, optional
- `change_amount` number, optional
- `cgst_total` number, optional
- `sgst_total` number, optional
- `discount_amount` number, optional

**`order_lines`** — add:
- `kot_status` string (pending | sent | cooking | ready | served)
- `gst_rate` number, optional
- `variant_id` string, optional
- `variant_name` string, optional
- `modifiers_total` number, optional

### New tables

**`item_variants`**
- `server_id` string, indexed
- `item_server_id` string, indexed (join to items by server_id)
- `name` string
- `price` number
- `is_active` boolean
- `sync_status` string (synced | pending | deleted)

**`modifier_groups`**
- `server_id` string, indexed
- `name` string
- `item_server_id` string, optional, indexed
- `min_selections` number
- `max_selections` number
- `is_required` boolean
- `sync_status` string

**`modifiers`**
- `server_id` string, indexed
- `modifier_group_id` string, indexed (join to modifier_groups by local id)
- `name` string
- `price` number
- `sort_order` number
- `is_active` boolean
- `sync_status` string

**`kots`**
- `server_id` string, optional, indexed
- `order_id` string, indexed (local WatermelonDB order id)
- `status` string (new | in_progress | ready | served)
- `created_at` number
- `sync_status` string

**`units`**
- `server_id` string, indexed
- `value` string (e.g. "PCS")
- `label` string (e.g. "Pieces")
- `status` string

**`combos`**
- `server_id` string, indexed
- `name` string
- `price` number
- `is_active` boolean
- `sync_status` string

**`combo_items`**
- `server_id` string, optional, indexed
- `combo_server_id` string, indexed
- `item_server_id` string, indexed
- `quantity` number

> **Migration note:** `src/db/migrations.ts` must export a WatermelonDB `migrations` object used by the `Database` constructor in `src/db/index.ts`. During dev: wipe + reinstall (`expo run:android`) to apply.

---

## Phase 2 — WatermelonDB Models

**Files (new/updated):**

Updated: `src/db/models/Item.ts`, `Order.ts`, `OrderLine.ts`  
New: `src/db/models/ItemVariant.ts`, `ModifierGroup.ts`, `Modifier.ts`, `Kot.ts`, `Unit.ts`, `Combo.ts`, `ComboItem.ts`

All follow the existing decorator pattern (`@field()`, extends `Model`, `static table`).

---

## Phase 3 — Sync Hooks (Three-Layer: API → WatermelonDB)

**Files (updated/new):**

Updated: `src/hooks/useItemsSync.ts`  
New: `src/hooks/useVariantsSync.ts`, `src/hooks/useModifierGroupsSync.ts`, `src/hooks/useUnitsSync.ts`, `src/hooks/useCombosSync.ts`

Pattern for every hook (mirrors existing `useItemsSync`):
```ts
// 1. Fetch from API (TanStack Query)
// 2. For each row: upsert into WatermelonDB (INSERT OR IGNORE + UPDATE)
// 3. Skip rows where local sync_status === 'pending'
// 4. Purge local rows whose server_id no longer appears in API response
```

`useItemsSync.ts` — extend to also sync `item_variants` and `modifier_groups` in the same pass.

`useVariantsSync.ts` — `GET /item-variants` paginated → upsert `item_variants` table  
`useModifierGroupsSync.ts` — `GET /modifier-groups` + modifiers nested → upsert both tables  
`useUnitsSync.ts` — `GET /units?status=active&per_page=500` → upsert `units`  
`useCombosSync.ts` — `GET /combos` + items → upsert `combos` + `combo_items`

---

## Phase 4 — Background Sync Engine

**File:** `src/lib/syncEngine.ts` (new)

Mirrors the Electron `SyncScheduler` pattern:

```ts
export function startSyncScheduler() {
  runAllSyncs()                           // immediate on start
  AppState.addEventListener('change', (state) => {
    if (state === 'active') runAllSyncs() // re-sync when foregrounded
  })
  setInterval(runAllSyncs, 30 * 60 * 1000) // 30-minute interval
}

async function runAllSyncs() {
  // refetch all sync query keys + pushPendingOrders()
}
```

**`src/store/syncStore.ts`** (new):
`{ status: 'idle' | 'syncing' | 'error', lastSyncAt: number | null, errors: string[] }`

---

## Phase 5 — CartStore + GST Utils + OrderActions

**`src/lib/utils.ts`** — add `calcGST`, `calcRoundOff`

**`src/store/cartStore.ts`** — add GST fields to CartLine, `orderType` state, enhanced `computeTotals()`

**`src/lib/orderActions.ts`** — extend:
- `sendKot()`: creates `kots` WatermelonDB row
- `checkout(paymentData)`: full payment fields written locally
- `cancelOrder(localOrderId)`
- `unholdOrder(localOrderId)`
- `updateKotStatus(kotId, status)`
- `resumeOrderIntoCart(localOrderId)`

---

## Phase 6 — New API Clients

**`src/api/inventory.ts`** (new): item/variant/modifier/combo CRUD (called after local write)  
**`src/api/kots.ts`** (new): `updateKotStatus(serverKotId, status)` PATCH

> No `src/api/reports.ts` — reports computed from WatermelonDB (offline-first).

---

## Phase 7 — Report Computation (Local DB Only)

**`src/lib/reportQueries.ts`** (new): WatermelonDB raw SQL aggregations

```ts
computeSalesSummary(from, to)
computeDayClose(date)
computeItemWise(from, to)
computeGstSummary(from, to)
```

Each report screen: trigger sync → wait for idle → call computeX() → render.

---

## Phase 8 — New Components

- `src/components/pos/PaymentModal.tsx` — Cash/UPI/Card/Credit + split payment
- `src/components/pos/VariantModifierModal.tsx` — Reads WatermelonDB (offline)
- `src/components/pos/ChefNoteInput.tsx` — Per-line note textarea
- `src/components/kitchen/KotCard.tsx` — KOT kanban card
- `src/components/ui/SyncStatusBar.tsx` — Sync status indicator

---

## Phase 9 — Enhanced Existing Screens

- `app/(tabs)/billing.tsx`: order type, variant modal, chef notes, PaymentModal, GST totals footer
- `app/(tabs)/tables.tsx`: resume occupied table via `resumeOrderIntoCart`
- `app/(tabs)/orders.tsx`: tabs (Active/Held/All), tappable rows → Order Detail
- `app/(tabs)/settings.tsx`: device info, sync status, links to Reports/Inventory
- `app/(tabs)/_layout.tsx`: 5th tab — Kitchen

---

## Phase 10 — New Stack Screens

- `app/order/[id].tsx` — Order Detail (view/resume/cancel/share receipt)
- `app/(tabs)/kitchen.tsx` — Kitchen KOT kanban (dark bg, 3 columns)
- `app/reports/sales.tsx` — Sales Summary
- `app/reports/day-close.tsx` — Day Close
- `app/reports/item-wise.tsx` — Item Wise
- `app/reports/gst.tsx` — GST Report
- `app/inventory/index.tsx` — Inventory menu
- `app/inventory/items.tsx` — Item list (WatermelonDB reactive)
- `app/inventory/item/[id].tsx` — Item create/edit (write-local-first)
- `app/inventory/modifiers.tsx` — Modifier group manager
- `app/inventory/combos.tsx` — Combo manager

---

## Phase 11 — Navigation Restructure

`app/(tabs)/_layout.tsx`: 5 tabs: Tables | Billing | Orders | Kitchen | Settings  
`app/_layout.tsx`: add all new stack routes for order, reports, inventory

---

## Three-Layer Compliance Checklist

| Screen | Zustand | WatermelonDB | API |
|---|---|---|---|
| Billing | cartStore | items, variants, modifiers | fire-and-forget on KOT/checkout |
| Tables | cartStore | dining_tables, floor_plans | fire-and-forget on status |
| Orders | — | orders | pull on refresh |
| Kitchen | — | kots, order_lines | fire-and-forget on status update |
| Order Detail | cartStore (on resume) | orders, order_lines | fire-and-forget on cancel |
| Reports | — | orders, order_lines (aggregate) | pull before compute |
| Inventory Items | — | items, item_variants | write-local-first → push |
| Inventory Modifiers | — | modifier_groups, modifiers | write-local-first → push |
| Inventory Combos | — | combos, combo_items | write-local-first → push |
| Settings | authStore | — | — |

---

## Verification

1. Kill network → all screens still show data (WatermelonDB serving)
2. Add items offline → send KOT → `kots` row in WatermelonDB → restore network → pushes to server
3. Report screens: trigger sync → compute from local DB → no direct API call
4. Inventory: create item offline → `sync_status='pending'` → reconnect → appears on server
5. Kitchen tab: KOT cards after KOT sent → tap status → moves column → server PATCH fires
6. Billing: item with variants → VariantModifierModal reads WatermelonDB (no network call)
7. Checkout: split UPI+Cash → totals validate → confirmed → table freed
