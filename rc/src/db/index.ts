import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import migrations from './migrations';

import Item from './models/Item';
import ItemGroup from './models/ItemGroup';
import ItemVariant from './models/ItemVariant';
import ModifierGroup from './models/ModifierGroup';
import Modifier from './models/Modifier';
import Unit from './models/Unit';
import FloorPlan from './models/FloorPlan';
import DiningTable from './models/DiningTable';
import Order from './models/Order';
import OrderLine from './models/OrderLine';
import Kot from './models/Kot';
import Combo from './models/Combo';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'rc',
  jsi: false, // RN Windows doesn't support JSI for WatermelonDB
  onSetUpError: error => {
    // eslint-disable-next-line no-console
    console.error('[db] adapter setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Item,
    ItemGroup,
    ItemVariant,
    ModifierGroup,
    Modifier,
    Unit,
    FloorPlan,
    DiningTable,
    Order,
    OrderLine,
    Kot,
    Combo,
  ],
});

// Typed collection getters
export const itemsCollection = database.get<Item>('items');
export const itemGroupsCollection = database.get<ItemGroup>('item_groups');
export const itemVariantsCollection = database.get<ItemVariant>('item_variants');
export const modifierGroupsCollection = database.get<ModifierGroup>('modifier_groups');
export const modifiersCollection = database.get<Modifier>('modifiers');
export const unitsCollection = database.get<Unit>('units');
export const floorPlansCollection = database.get<FloorPlan>('floor_plans');
export const diningTablesCollection = database.get<DiningTable>('dining_tables');
export const ordersCollection = database.get<Order>('orders');
export const orderLinesCollection = database.get<OrderLine>('order_lines');
export const kotsCollection = database.get<Kot>('kots');
export const combosCollection = database.get<Combo>('combos');
