import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Modifier extends Model {
  static table = 'modifiers';
  static associations = {
    modifier_groups: { type: 'belongs_to' as const, key: 'modifier_group_id' },
  };

  @field('server_id') serverId!: string;
  @field('modifier_group_id') modifierGroupId!: string;
  @field('name') name!: string;
  @field('price') price!: number;
  @field('sort_order') sortOrder!: number;
  @field('is_active') isActive!: boolean;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'deleted';
}
