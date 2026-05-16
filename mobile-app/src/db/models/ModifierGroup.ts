import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';

export default class ModifierGroup extends Model {
  static table = 'modifier_groups';
  static associations = {
    modifiers: { type: 'has_many' as const, foreignKey: 'modifier_group_id' },
  };

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('item_server_id') itemServerId!: string | null;
  @field('min_selections') minSelections!: number;
  @field('max_selections') maxSelections!: number;
  @field('is_required') isRequired!: boolean;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'deleted';

  @children('modifiers') modifiers!: any;
}
