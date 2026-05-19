import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';

export type SyncState = 'pending' | 'synced' | 'failed';

export default class Item extends Model {
  static table = 'items';

  @text('server_id') serverId!: string | null;
  @text('name') name!: string;
  @text('sku') sku!: string | null;
  @field('price') price!: number;
  @text('unit') unit!: string | null;
  @text('item_group_server_id') itemGroupServerId!: string | null;
  @text('image_url') imageUrl!: string | null;
  @field('cgst_pct') cgstPct!: number | null;
  @field('sgst_pct') sgstPct!: number | null;
  @field('has_variants') hasVariants!: boolean;
  @field('has_modifiers') hasModifiers!: boolean;
  @field('is_active') isActive!: boolean;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
