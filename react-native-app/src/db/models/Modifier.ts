import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class Modifier extends Model {
  static table = 'modifiers';

  @text('server_id') serverId!: string | null;
  @text('modifier_group_server_id') modifierGroupServerId!: string;
  @text('name') name!: string;
  @field('price') price!: number;
  @field('sort_order') sortOrder!: number;
  @field('is_active') isActive!: boolean;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
