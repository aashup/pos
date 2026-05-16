import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class ItemVariant extends Model {
  static table = 'item_variants';

  @field('server_id') serverId!: string;
  @field('item_server_id') itemServerId!: string;
  @field('name') name!: string;
  @field('price') price!: number;
  @field('is_active') isActive!: boolean;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'deleted';
}
