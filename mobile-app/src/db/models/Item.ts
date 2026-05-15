import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Item extends Model {
  static table = 'items';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('price') price!: number;
  @field('barcode') barcode!: string | null;
  @field('item_group_id') itemGroupId!: string;
  @field('image_url') imageUrl!: string | null;
  @field('is_active') isActive!: boolean;
  @field('synced_at') syncedAt!: number | null;
}
