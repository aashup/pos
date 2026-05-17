import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';
import type DiningTable from './DiningTable';

export default class FloorPlan extends Model {
  static table = 'floor_plans';
  static associations = {
    dining_tables: { type: 'has_many' as const, foreignKey: 'floor_plan_id' },
  };

  @field('server_id') serverId!: string;
  @field('name') name!: string;

  @children('dining_tables') tables!: any;
}
