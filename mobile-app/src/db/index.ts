import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import Item from './models/Item';
import ItemGroup from './models/ItemGroup';
import FloorPlan from './models/FloorPlan';
import DiningTable from './models/DiningTable';
import Order from './models/Order';
import OrderLine from './models/OrderLine';
import LocationLog from './models/LocationLog';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'zazzy_mobile',
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Item, ItemGroup, FloorPlan, DiningTable, Order, OrderLine, LocationLog],
});
