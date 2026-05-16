import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';

export default class Order extends Model {
  static table = 'orders';
  static associations = {
    order_lines: { type: 'has_many' as const, foreignKey: 'order_id' },
    kots: { type: 'has_many' as const, foreignKey: 'order_id' },
  };

  @field('server_id') serverId!: string | null;
  @field('table_id') tableId!: string;
  @field('table_name') tableName!: string;
  @field('status') status!: 'open' | 'held' | 'confirmed' | 'cancelled';
  @field('sync_status') syncStatus!: 'pending' | 'synced';
  @field('total_amount') totalAmount!: number;
  @field('created_at') createdAt!: number;
  @field('order_type') orderType!: 'dine_in' | 'takeaway' | 'delivery';
  @field('payment_mode') paymentMode!: string | null;
  @field('amount_paid') amountPaid!: number | null;
  @field('amount_tendered') amountTendered!: number | null;
  @field('change_amount') changeAmount!: number | null;
  @field('cgst_total') cgstTotal!: number | null;
  @field('sgst_total') sgstTotal!: number | null;
  @field('discount_amount') discountAmount!: number | null;

  @children('order_lines') lines!: any;
  @children('kots') kots!: any;
}
