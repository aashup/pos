import {Model} from '@nozbe/watermelondb';
import {text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class Unit extends Model {
  static table = 'units';

  @text('server_id') serverId!: string | null;
  @text('value') value!: string;
  @text('label') label!: string;
  @text('status') status!: string;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
