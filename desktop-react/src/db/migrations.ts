import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // Add new columns to items
        addColumns({
          table: 'items',
          columns: [
            { name: 'gst_rate', type: 'number', isOptional: true },
            { name: 'cgst_pct', type: 'number', isOptional: true },
            { name: 'sgst_pct', type: 'number', isOptional: true },
            { name: 'unit', type: 'string', isOptional: true },
            { name: 'sku', type: 'string', isOptional: true },
            { name: 'has_variants', type: 'boolean' },
            { name: 'has_modifiers', type: 'boolean' },
          ],
        }),
        // Add new columns to orders
        addColumns({
          table: 'orders',
          columns: [
            { name: 'order_type', type: 'string' },
            { name: 'payment_mode', type: 'string', isOptional: true },
            { name: 'amount_paid', type: 'number', isOptional: true },
            { name: 'amount_tendered', type: 'number', isOptional: true },
            { name: 'change_amount', type: 'number', isOptional: true },
            { name: 'cgst_total', type: 'number', isOptional: true },
            { name: 'sgst_total', type: 'number', isOptional: true },
            { name: 'discount_amount', type: 'number', isOptional: true },
          ],
        }),
        // Add new columns to order_lines
        addColumns({
          table: 'order_lines',
          columns: [
            { name: 'kot_status', type: 'string' },
            { name: 'gst_rate', type: 'number', isOptional: true },
            { name: 'variant_id', type: 'string', isOptional: true },
            { name: 'variant_name', type: 'string', isOptional: true },
            { name: 'modifiers_total', type: 'number', isOptional: true },
            { name: 'kot_id', type: 'string', isOptional: true },
          ],
        }),
        // New tables
        createTable({
          name: 'item_variants',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'item_server_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'is_active', type: 'boolean' },
            { name: 'sync_status', type: 'string' },
          ],
        }),
        createTable({
          name: 'modifier_groups',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'item_server_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'min_selections', type: 'number' },
            { name: 'max_selections', type: 'number' },
            { name: 'is_required', type: 'boolean' },
            { name: 'sync_status', type: 'string' },
          ],
        }),
        createTable({
          name: 'modifiers',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'modifier_group_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'sort_order', type: 'number' },
            { name: 'is_active', type: 'boolean' },
            { name: 'sync_status', type: 'string' },
          ],
        }),
        createTable({
          name: 'kots',
          columns: [
            { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'order_id', type: 'string', isIndexed: true },
            { name: 'status', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'sync_status', type: 'string' },
          ],
        }),
        createTable({
          name: 'units',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'value', type: 'string' },
            { name: 'label', type: 'string' },
            { name: 'status', type: 'string' },
          ],
        }),
        createTable({
          name: 'combos',
          columns: [
            { name: 'server_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'is_active', type: 'boolean' },
            { name: 'sync_status', type: 'string' },
          ],
        }),
        createTable({
          name: 'combo_items',
          columns: [
            { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'combo_server_id', type: 'string', isIndexed: true },
            { name: 'item_server_id', type: 'string', isIndexed: true },
            { name: 'quantity', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
