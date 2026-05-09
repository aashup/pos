-- Device configuration (local only)
CREATE TABLE IF NOT EXISTS device_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ── Synced DOWN (read cache from server) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS item_groups (
  id         TEXT PRIMARY KEY,
  company_id TEXT,
  parent_id  TEXT,
  name       TEXT,
  is_active  INTEGER DEFAULT 1,
  synced_at  TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id             TEXT PRIMARY KEY,
  company_id     TEXT,
  item_group_id  TEXT,
  name           TEXT,
  sku            TEXT,
  barcode        TEXT,
  unit           TEXT,
  selling_price  REAL DEFAULT 0,
  cgst           REAL DEFAULT 0,
  sgst           REAL DEFAULT 0,
  igst           REAL DEFAULT 0,
  is_active      INTEGER DEFAULT 1,
  synced_at      TEXT
);

CREATE TABLE IF NOT EXISTS godowns (
  id         TEXT PRIMARY KEY,
  company_id TEXT,
  name       TEXT,
  is_default INTEGER DEFAULT 0,
  synced_at  TEXT
);

CREATE TABLE IF NOT EXISTS floor_plans (
  id         TEXT PRIMARY KEY,
  company_id TEXT,
  name       TEXT,
  sort_order INTEGER DEFAULT 0,
  synced_at  TEXT
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id               TEXT PRIMARY KEY,
  company_id       TEXT,
  floor_plan_id    TEXT,
  name             TEXT,
  capacity         INTEGER DEFAULT 4,
  shape            TEXT DEFAULT 'square',
  pos_x            INTEGER DEFAULT 0,
  pos_y            INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'vacant',
  current_order_id TEXT,
  is_active        INTEGER DEFAULT 1,
  sync_status      TEXT DEFAULT 'synced',
  updated_at_local TEXT,
  synced_at        TEXT
);

-- ── Synced UP (created offline, pushed to server) ─────────────────────────────

CREATE TABLE IF NOT EXISTS sales_invoices (
  id               TEXT PRIMARY KEY,
  company_id       TEXT,
  device_id        TEXT,
  order_type       TEXT DEFAULT 'takeaway',
  table_id         TEXT,
  pax              INTEGER DEFAULT 1,
  party_id         TEXT,
  invoice_number   TEXT,
  invoice_date     TEXT,
  status           TEXT DEFAULT 'draft',
  pos_held         INTEGER DEFAULT 0,
  total_amount     REAL DEFAULT 0,
  discount_amount  REAL DEFAULT 0,
  taxable_amount   REAL DEFAULT 0,
  cgst_total       REAL DEFAULT 0,
  sgst_total       REAL DEFAULT 0,
  igst_total       REAL DEFAULT 0,
  grand_total      REAL DEFAULT 0,
  round_off        REAL DEFAULT 0,
  amount_paid      REAL DEFAULT 0,
  amount_tendered  REAL DEFAULT 0,
  change_amount    REAL DEFAULT 0,
  balance_due      REAL DEFAULT 0,
  pos_payment_mode TEXT,
  kot_count        INTEGER DEFAULT 0,
  notes            TEXT,
  sync_status      TEXT DEFAULT 'pending',
  updated_at_local TEXT,
  synced_at        TEXT,
  created_at       TEXT,
  updated_at       TEXT
);

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id               TEXT PRIMARY KEY,
  sales_invoice_id TEXT,
  item_id          TEXT,
  item_name        TEXT,
  quantity         REAL,
  rate             REAL,
  discount_percent REAL DEFAULT 0,
  gst_rate         REAL DEFAULT 0,
  cgst             REAL DEFAULT 0,
  sgst             REAL DEFAULT 0,
  igst             REAL DEFAULT 0,
  taxable_amount   REAL DEFAULT 0,
  line_total       REAL DEFAULT 0,
  kot_status       TEXT DEFAULT 'pending',
  notes            TEXT,
  sync_status      TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS kots (
  id               TEXT PRIMARY KEY,
  company_id       TEXT,
  sales_invoice_id TEXT,
  kot_number       TEXT,
  status           TEXT DEFAULT 'new',
  notes            TEXT,
  print_count      INTEGER DEFAULT 0,
  sync_status      TEXT DEFAULT 'pending',
  updated_at_local TEXT,
  synced_at        TEXT,
  created_at       TEXT
);

CREATE TABLE IF NOT EXISTS kot_lines (
  id           TEXT PRIMARY KEY,
  kot_id       TEXT,
  item_id      TEXT,
  item_name    TEXT,
  variant_name TEXT,
  quantity     REAL,
  notes        TEXT,
  status       TEXT DEFAULT 'pending'
);

-- ── Local tracking ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT,
  record_id  TEXT,
  operation  TEXT,
  payload    TEXT,
  created_at TEXT,
  attempts   INTEGER DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_group       ON items(item_group_id);
CREATE INDEX IF NOT EXISTS idx_items_active      ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_dining_tables_fp  ON dining_tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status    ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines     ON sales_invoice_lines(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_kots_invoice      ON kots(sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table  ON sync_queue(table_name, attempts);
