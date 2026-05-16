import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import Item from './models/Item';
import ItemGroup from './models/ItemGroup';
import ItemVariant from './models/ItemVariant';
import ModifierGroup from './models/ModifierGroup';
import Modifier from './models/Modifier';
import FloorPlan from './models/FloorPlan';
import DiningTable from './models/DiningTable';
import Order from './models/Order';
import OrderLine from './models/OrderLine';
import Kot from './models/Kot';
import Unit from './models/Unit';
import Combo from './models/Combo';
import ComboItem from './models/ComboItem';
import LocationLog from './models/LocationLog';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'zazzy_mobile',
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
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
    FloorPlan,
    DiningTable,
    Order,
    OrderLine,
    Kot,
    Unit,
    Combo,
    ComboItem,
    LocationLog,
  ],
});
