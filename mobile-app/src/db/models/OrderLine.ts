import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class OrderLine extends Model {
  static table = 'order_lines';
  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
  };

  @field('order_id') orderId!: string;
  @field('item_id') itemId!: string;
  @field('item_name') itemName!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number;
  @field('note') note!: string | null;
  @field('sent') sent!: boolean;
}
