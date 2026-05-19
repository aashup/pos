import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class ItemGroup extends Model {
  static table = 'item_groups';

  @text('server_id') serverId!: string | null;
  @text('name') name!: string;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
