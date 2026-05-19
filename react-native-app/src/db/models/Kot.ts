import {Model} from '@nozbe/watermelondb';
import {text, date, readonly, relation} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export type KotMainStatus = 'new' | 'in_progress' | 'ready' | 'served';

export default class Kot extends Model {
  static table = 'kots';
  static associations = {
    orders: {type: 'belongs_to' as const, key: 'order_id'},
  };

  @text('server_id') serverId!: string | null;
  @text('order_id') orderId!: string;
  @text('status') status!: KotMainStatus;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('orders', 'order_id') order: any;
}
