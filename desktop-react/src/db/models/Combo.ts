import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';

export default class Combo extends Model {
  static table = 'combos';
  static associations = {
    combo_items: { type: 'has_many' as const, foreignKey: 'combo_server_id' },
  };

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('price') price!: number;
  @field('is_active') isActive!: boolean;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'deleted';

  @children('combo_items') comboItems!: any;
}
