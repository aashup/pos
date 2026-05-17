import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class ComboItem extends Model {
  static table = 'combo_items';
  static associations = {
    combos: { type: 'belongs_to' as const, key: 'combo_server_id' },
  };

  @field('server_id') serverId!: string | null;
  @field('combo_server_id') comboServerId!: string;
  @field('item_server_id') itemServerId!: string;
  @field('quantity') quantity!: number;
}
