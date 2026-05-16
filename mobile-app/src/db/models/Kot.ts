import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';

export default class Kot extends Model {
  static table = 'kots';
  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
    order_lines: { type: 'has_many' as const, foreignKey: 'kot_id' },
  };

  @field('server_id') serverId!: string | null;
  @field('order_id') orderId!: string;
  @field('status') status!: 'new' | 'in_progress' | 'ready' | 'served';
  @field('created_at') createdAt!: number;
  @field('sync_status') syncStatus!: 'pending' | 'synced';

  @children('order_lines') lines!: any;
}
