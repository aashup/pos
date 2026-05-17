import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'item_groups',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'items',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'barcode', type: 'string', isOptional: true },
        { name: 'item_group_id', type: 'string', isIndexed: true },
        { name: 'image_url', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'gst_rate', type: 'number', isOptional: true },
        { name: 'cgst_pct', type: 'number', isOptional: true },
        { name: 'sgst_pct', type: 'number', isOptional: true },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'sku', type: 'string', isOptional: true },
        { name: 'has_variants', type: 'boolean' },
        { name: 'has_modifiers', type: 'boolean' },
      ],
    }),
    tableSchema({
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
    tableSchema({
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
    tableSchema({
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
    tableSchema({
      name: 'floor_plans',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'dining_tables',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'floor_plan_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'status', type: 'string' }, // vacant | occupied | reserved | cleaning
        { name: 'current_order_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'table_id', type: 'string', isIndexed: true },
        { name: 'table_name', type: 'string' },
        { name: 'status', type: 'string' }, // open | held | confirmed | cancelled
        { name: 'sync_status', type: 'string' }, // pending | synced
        { name: 'total_amount', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'order_type', type: 'string' }, // dine_in | takeaway | delivery
        { name: 'payment_mode', type: 'string', isOptional: true },
        { name: 'amount_paid', type: 'number', isOptional: true },
        { name: 'amount_tendered', type: 'number', isOptional: true },
        { name: 'change_amount', type: 'number', isOptional: true },
        { name: 'cgst_total', type: 'number', isOptional: true },
        { name: 'sgst_total', type: 'number', isOptional: true },
        { name: 'discount_amount', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'order_lines',
      columns: [
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'item_id', type: 'string' },
        { name: 'item_name', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'price', type: 'number' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'sent', type: 'boolean' },
        { name: 'kot_status', type: 'string' }, // pending | sent | cooking | ready | served
        { name: 'gst_rate', type: 'number', isOptional: true },
        { name: 'variant_id', type: 'string', isOptional: true },
        { name: 'variant_name', type: 'string', isOptional: true },
        { name: 'modifiers_total', type: 'number', isOptional: true },
        { name: 'kot_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'kots',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'order_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' }, // new | in_progress | ready | served
        { name: 'created_at', type: 'number' },
        { name: 'sync_status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'units',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
        { name: 'label', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'combos',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'sync_status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'combo_items',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'combo_server_id', type: 'string', isIndexed: true },
        { name: 'item_server_id', type: 'string', isIndexed: true },
        { name: 'quantity', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'location_logs',
      columns: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'accuracy', type: 'number', isOptional: true },
        { name: 'recorded_at', type: 'number' },
        { name: 'synced', type: 'boolean' }, // always false — no server endpoint
      ],
    }),
  ],
});
