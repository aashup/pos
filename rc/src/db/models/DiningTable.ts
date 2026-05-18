import {Model} from '@nozbe/watermelondb';
import {text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export type TableStatus = 'vacant' | 'occupied' | 'reserved' | 'cleaning';

export default class DiningTable extends Model {
  static table = 'dining_tables';

  @text('server_id') serverId!: string | null;
  @text('floor_plan_server_id') floorPlanServerId!: string;
  @text('name') name!: string;
  @text('status') status!: TableStatus;
  @text('current_order_id') currentOrderId!: string | null;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
