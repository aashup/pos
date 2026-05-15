import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
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
        { name: 'sent', type: 'boolean' }, // true after KOT sent
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
