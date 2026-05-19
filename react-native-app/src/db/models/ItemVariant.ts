import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class ItemVariant extends Model {
  static table = 'item_variants';

  @text('server_id') serverId!: string | null;
  @text('item_server_id') itemServerId!: string;
  @text('name') name!: string;
  @field('price') price!: number;
  @field('is_active') isActive!: boolean;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
