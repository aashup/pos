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
  @field('gst_rate') gstRate!: number | null;
  @field('cgst_pct') cgstPct!: number | null;
  @field('sgst_pct') sgstPct!: number | null;
  @field('unit') unit!: string | null;
  @field('sku') sku!: string | null;
  @field('has_variants') hasVariants!: boolean;
  @field('has_modifiers') hasModifiers!: boolean;
}
