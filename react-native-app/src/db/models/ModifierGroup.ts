import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class ModifierGroup extends Model {
  static table = 'modifier_groups';

  @text('server_id') serverId!: string | null;
  @text('name') name!: string;
  @text('item_server_id') itemServerId!: string | null;
  @field('min_selections') minSelections!: number;
  @field('max_selections') maxSelections!: number;
  @field('is_required') isRequired!: boolean;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
