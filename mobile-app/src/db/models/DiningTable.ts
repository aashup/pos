import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class DiningTable extends Model {
  static table = 'dining_tables';
  static associations = {
    floor_plans: { type: 'belongs_to' as const, key: 'floor_plan_id' },
  };

  @field('server_id') serverId!: string;
  @field('floor_plan_id') floorPlanId!: string;
  @field('name') name!: string;
  @field('status') status!: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
  @field('current_order_id') currentOrderId!: string | null;
}
