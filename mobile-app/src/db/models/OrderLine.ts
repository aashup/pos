import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class OrderLine extends Model {
  static table = 'order_lines';
  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
    kots: { type: 'belongs_to' as const, key: 'kot_id' },
  };

  @field('order_id') orderId!: string;
  @field('item_id') itemId!: string;
  @field('item_name') itemName!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number;
  @field('note') note!: string | null;
  @field('sent') sent!: boolean;
  @field('kot_status') kotStatus!: 'pending' | 'sent' | 'cooking' | 'ready' | 'served';
  @field('gst_rate') gstRate!: number | null;
  @field('variant_id') variantId!: string | null;
  @field('variant_name') variantName!: string | null;
  @field('modifiers_total') modifiersTotal!: number | null;
  @field('kot_id') kotId!: string | null;
}
