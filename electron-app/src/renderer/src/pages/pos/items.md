# Plan: Variants, Modifiers, Combos & Images

## Context

The current POS has a flat item model — `items` table with a fixed `selling_price`, no size/type support, no add-ons, and no bundle/combo functionality. The `recipes` table partially covers variants (one-to-one per item) but is wired to kitchen inventory costing, not POS selection. `kot_lines` has a text-only `variant_name` field for display. No image system exists anywhere.

This plan introduces a clean, separated relational structure without collapsing concepts into one table.

---

## Final Table Design

### 1. `item_variants` — Size / Type (e.g., Small, Medium, Large)
Each row is one purchasable version of an item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `item_id` | uuid FK → items | |
| `name` | string | "Small", "Large", "Half", "Full" |
| `price_override` | decimal(10,2) nullable | null = use item.selling_price |
| `sku` | string nullable | |
| `sort_order` | unsignedInt default 0 | |
| `is_active` | bool default true | |
| sync cols | — | `sync_status`, `device_id`, `synced_at` |

**Rule:** If an item has NO variants, it sells as-is. If it has variants, cashier must pick one.

---

### 2. `modifier_groups` — Add-on Categories (e.g., "Spice Level", "Toppings")

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `name` | string | "Extra Cheese", "Spice Level" |
| `is_required` | bool default false | force cashier to pick |
| `min_selections` | unsignedInt default 0 | |
| `max_selections` | unsignedInt default 1 | 1 = single-select |
| `sort_order` | unsignedInt default 0 | |
| `is_active` | bool default true | |
| sync cols | — | |

---

### 3. `modifiers` — Options within a Group (e.g., "Extra Cheese +₹20")

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `modifier_group_id` | uuid FK → modifier_groups | |
| `name` | string | "Mild", "Medium", "Hot" |
| `price` | decimal(10,2) default 0 | surcharge added to line total |
| `sort_order` | unsignedInt default 0 | |
| `is_active` | bool default true | |
| sync cols | — | |

---

### 4. `item_modifier_groups` — Pivot: which items get which modifier groups

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `item_id` | uuid FK → items | |
| `modifier_group_id` | uuid FK → modifier_groups | |
| `sort_order` | unsignedInt default 0 | |

No sync cols needed — purely structural, always synced as part of item setup.

---

### 5. `combos` — Bundle / Meal Deal

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `name` | string | "Burger Meal", "Family Pack" |
| `description` | text nullable | |
| `price` | decimal(10,2) | fixed combo price |
| `is_active` | bool default true | |
| `sort_order` | unsignedInt default 0 | |
| sync cols | — | |

---

### 6. `combo_items` — What items are inside a combo

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `combo_id` | uuid FK → combos | |
| `item_id` | uuid FK → items | |
| `item_variant_id` | uuid FK → item_variants nullable | pin to a specific size |
| `quantity` | unsignedInt default 1 | |
| `sort_order` | unsignedInt default 0 | |

---

### 7. `media` — Image gallery per entity (polymorphic)

Images uploaded to Laravel and stored on server disk (or S3 via Laravel Filesystem). Only the public URL is synced to local SQLite — no binary data moves offline.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `entity_type` | enum: `item`, `item_variant`, `combo`, `modifier_group` | |
| `entity_id` | uuid | FK to whichever entity |
| `url` | string | public URL served by Laravel `/storage/...` |
| `storage_path` | string | server-side path used for `Storage::delete()` |
| `disk` | string default `'public'` | Laravel disk name (local / s3) |
| `sort_order` | unsignedInt default 0 | |
| `is_primary` | bool default false | hero image shown in ItemGrid |
| `created_at`, `updated_at` | timestamps | |
| sync cols | — | URL only synced to SQLite |

---

## Combo Cart Behaviour

When a cashier adds a combo to the cart:
- Cart shows **one line**: `"Burger Meal — ₹299"` at the fixed combo price.
- `sales_invoice_line` stores `combo_id` (nullable, new column) instead of `item_id` when it's a combo line.
- KOT generation **expands** the combo into individual `kot_lines` (one per combo_item), each with the correct `item_id`, `variant_name`, and `modifier_summary`.
- The combo's own modifier groups (e.g., sauce choice on a Family Pack) are collected at add-to-cart time and stored in `sales_invoice_line_modifiers` linked to the combo line.

Column addition to `sales_invoice_lines`:
- Add `combo_id` uuid nullable FK → combos (mutually exclusive with `item_id` — either an item line or a combo line)

---

## Changes to Existing Tables (edit original migrations — do NOT create new ones)

### `sales_invoice_lines` — add variant + modifier + combo columns
- Add `item_variant_id` uuid nullable FK → item_variants
- Add `combo_id` uuid nullable FK → combos
- Add `modifiers_total` decimal(10,2) default 0 (sum of modifier surcharges on this line)

### `kot_lines` — add modifier display text
- Add `modifier_summary` string nullable (e.g., "Spicy + Extra Cheese" — for kitchen display)
- Already has `variant_name` text ✓

---

### 8. `sales_invoice_line_modifiers` — which modifiers were selected per line

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `sales_invoice_line_id` | uuid FK | |
| `modifier_id` | uuid FK → modifiers | |
| `modifier_name` | string | snapshot at time of order |
| `price_at_time` | decimal(10,2) | snapshot to handle future price changes |
| sync cols | — | created locally, synced up |

---

## SQLite Mirror (electron-app/src/main/db/schema.sql)

Sync DOWN (read-only cache):
- `item_variants`
- `modifier_groups`
- `modifiers`
- `item_modifier_groups`
- `combos`
- `combo_items`
- `media` (url + entity_type/id only — no storage_path needed offline)

Sync UP (created locally):
- `sales_invoice_line_modifiers`

Columns added to existing local tables:
- `sales_invoice_lines`: `item_variant_id`, `modifiers_total`
- `kot_lines`: `modifier_summary`

---

## Laravel API (critical: edit original migrations)

**Migration files to edit:**
- `api/database/migrations/2026_03_24_000016_create_sales_invoices_table.php` — add columns to `sales_invoice_lines`
- `api/database/migrations/2026_04_11_create_document_counters_table.php` — add `modifier_summary` to `kot_lines`

**New tables go into a single new migration:**
`api/database/migrations/2026_05_09_000001_create_variants_modifiers_combos_media.php`
_(this is new functionality — a new migration is correct here; the "no new migrations" policy applies to editing existing columns on existing tables)_

**New Models:**
- `ItemVariant`, `ModifierGroup`, `Modifier`, `ItemModifierGroup`, `Combo`, `ComboItem`, `Media`, `SalesInvoiceLineModifier`

**New Controllers + Routes:**
```
GET/POST/PATCH/DELETE  /api/item-variants
GET/POST/PATCH/DELETE  /api/modifier-groups          (with nested modifiers)
GET/POST/PATCH/DELETE  /api/modifiers
GET/POST/PATCH/DELETE  /api/combos                   (with nested combo_items)
POST/DELETE            /api/media                    (upload/delete image, multipart/form-data)
GET                    /api/media?entity_type=X&entity_id=Y
```

**Media Upload Flow:**
`POST /api/media` → `MediaController@store` → `$request->file('image')->store('media', 'public')` → saves URL + storage_path → returns record. Delete calls `Storage::disk()->delete(storage_path)`.

---

## TypeScript Types to Add (electron-app/src/renderer/src/types/index.ts)

```typescript
ItemVariant { id, item_id, name, price_override, sku, sort_order, is_active }
ModifierGroup { id, company_id, name, is_required, min_selections, max_selections, modifiers? }
Modifier { id, modifier_group_id, name, price, sort_order, is_active }
Combo { id, company_id, name, description, price, is_active, items?: ComboItem[] }
ComboItem { id, combo_id, item_id, item_variant_id, quantity }
MediaItem { id, entity_type, entity_id, url, is_primary, sort_order }
```

CartLine extended:
```typescript
CartLine { ...existing, item_variant_id?, variant_name?, selected_modifiers?: SelectedModifier[] }
SelectedModifier { modifier_id, modifier_name, price }
```

---

## Verification

1. Run `php artisan migrate` — all new tables created cleanly
2. Create an item (e.g., Burger), add variants (Small/Large), attach a modifier group (Toppings → Cheese/Jalapeño)
3. In POS: add Burger → variant picker appears → modifier picker appears → line appears in cart with variant name + modifier total
4. Send to Kitchen → KOT line shows `variant_name` + `modifier_summary`
5. Checkout → `sales_invoice_line_modifiers` records saved; `modifiers_total` reflected in line total
6. Create a Combo, verify it appears in ItemGrid, adds all combo_items to cart as one bundle at combo price
7. Upload image for an item → appears in ItemGrid card