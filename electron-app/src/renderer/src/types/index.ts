// ── Core ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  company_id: string
  name: string
  email: string
  role: string
  company?: Company
}

export interface Company {
  id: string
  name: string
  gstin: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export interface ItemGroup {
  id: string
  company_id: string
  parent_id: string | null
  name: string
  is_active: boolean
}

export interface Item {
  id: string
  company_id: string
  item_group_id: string | null
  name: string
  sku: string | null
  unit: string
  selling_price: number | null
  cgst: number
  sgst: number
  igst: number
  is_active: boolean
  item_group?: ItemGroup
  variants?: ItemVariant[]
  modifier_groups?: ModifierGroup[]
  media?: MediaItem[]
}

// ── Variants ──────────────────────────────────────────────────────────────────

export interface ItemVariant {
  id: string
  item_id: string
  name: string
  price_override: number | null
  sku: string | null
  sort_order: number
  is_active: boolean
  media?: MediaItem[]
}

// ── Modifiers ─────────────────────────────────────────────────────────────────

export interface ModifierGroup {
  id: string
  company_id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  is_active: boolean
  modifiers?: Modifier[]
  media?: MediaItem[]
}

export interface Modifier {
  id: string
  modifier_group_id: string
  name: string
  price: number
  sort_order: number
  is_active: boolean
}

export interface SelectedModifier {
  modifier_id: string
  modifier_name: string
  price: number
}

// ── Combos ────────────────────────────────────────────────────────────────────

export interface Combo {
  id: string
  company_id: string
  name: string
  description: string | null
  price: number
  cgst: number
  sgst: number
  igst: number
  sort_order: number
  is_active: boolean
  combo_items?: ComboItem[]
  modifier_groups?: ModifierGroup[]
  media?: MediaItem[]
}

export interface ComboItem {
  id: string
  combo_id: string
  item_id: string
  item_variant_id: string | null
  quantity: number
  sort_order: number
  item?: Item
  variant?: ItemVariant
}

// ── Media ─────────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string
  entity_type: 'item' | 'item_variant' | 'combo' | 'modifier_group'
  entity_id: string
  url: string
  sort_order: number
  is_primary: boolean
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartLine {
  id: string          // local UUID (not server ID)
  itemId: string
  comboId: string | null
  name: string
  rate: number
  unit: string
  gstRate: number
  quantity: number
  discountPct: number
  modifiersTotal: number
  kotStatus: 'pending' | 'sent' | 'cooking' | 'ready' | 'served'
  notes: string
  variantId: string | null
  variantName: string | null
  selectedModifiers: SelectedModifier[]
}

// ── Restaurant Orders ──────────────────────────────────────────────────────────

export type OrderType = 'dine_in' | 'takeaway' | 'delivery'

export interface SalesInvoice {
  id: string
  company_id: string
  order_type: OrderType
  table_id: string | null
  pax: number
  invoice_number: string | null
  invoice_date: string
  status: 'draft' | 'confirmed' | 'cancelled'
  pos_held: boolean
  grand_total: number
  cgst_total: number
  sgst_total: number
  taxable_amount: number
  discount_amount: number
  amount_paid: number
  amount_tendered: number
  change_amount: number
  balance_due: number
  kot_count: number
  pos_payment_mode: string | null
  notes: string | null
  dining_table?: DiningTable
  lines?: SalesInvoiceLine[]
  kots?: KOT[]
}

export interface SalesInvoiceLine {
  id: string
  sales_invoice_id: string
  item_id: string | null
  item_variant_id: string | null
  combo_id: string | null
  quantity: number
  rate: number
  discount_percent: number
  modifiers_total: number
  gst_rate: number
  cgst: number
  sgst: number
  igst: number
  taxable_amount: number
  line_total: number
  kot_status: string
  notes: string | null
  item?: Item
  variant?: ItemVariant
  combo?: Combo
  selected_modifiers?: SalesInvoiceLineModifier[]
}

export interface SalesInvoiceLineModifier {
  id: string
  sales_invoice_line_id: string
  modifier_id: string
  modifier_name: string
  price_at_time: number
}

// ── Tables ────────────────────────────────────────────────────────────────────

export interface FloorPlan {
  id: string
  company_id: string
  name: string
  sort_order: number
  tables?: DiningTable[]
}

export type TableStatus = 'vacant' | 'occupied' | 'reserved' | 'cleaning'

export interface DiningTable {
  id: string
  company_id: string
  floor_plan_id: string
  name: string
  capacity: number
  shape: 'square' | 'round' | 'rectangle'
  pos_x: number
  pos_y: number
  status: TableStatus
  current_order_id: string | null
  is_active: boolean
  floor_plan?: FloorPlan
  current_order?: SalesInvoice
}

// ── KOT ───────────────────────────────────────────────────────────────────────

export interface KOT {
  id: string
  server_id?: string | null
  company_id: string
  sales_invoice_id: string
  kot_number: string
  status: 'new' | 'in_progress' | 'ready' | 'served'
  print_count: number
  notes: string | null
  created_at?: string
  lines?: KOTLine[]
}

export interface KOTLine {
  id: string
  kot_id: string
  item_id: string
  item_name: string
  variant_name: string | null
  modifier_summary: string | null
  quantity: number
  notes: string | null
  status: 'pending' | 'cooking' | 'ready'
}
