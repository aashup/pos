import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class ItemGroup extends Model {
  static table = 'item_groups';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
}
