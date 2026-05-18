import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly, relation} from '@nozbe/watermelondb/decorators';

export type KotStatus = 'pending' | 'sent' | 'cooking' | 'ready' | 'served';

export default class OrderLine extends Model {
  static table = 'order_lines';
  static associations = {
    orders: {type: 'belongs_to' as const, key: 'order_id'},
  };

  @text('order_id') orderId!: string;
  @text('item_server_id') itemServerId!: string;
  @text('item_name') itemName!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number;
  @text('note') note!: string | null;
  @text('kot_status') kotStatus!: KotStatus;
  @text('kot_id') kotId!: string | null;
  @field('gst_rate') gstRate!: number | null;
  @text('variant_server_id') variantServerId!: string | null;
  @text('variant_name') variantName!: string | null;
  @field('modifiers_total') modifiersTotal!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('orders', 'order_id') order: any;
}
