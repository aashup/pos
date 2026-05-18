import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly, children} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export type OrderStatus = 'open' | 'held' | 'confirmed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'split';

export default class Order extends Model {
  static table = 'orders';
  static associations = {
    order_lines: {type: 'has_many' as const, foreignKey: 'order_id'},
    kots: {type: 'has_many' as const, foreignKey: 'order_id'},
  };

  @text('server_id') serverId!: string | null;
  @text('table_id') tableId!: string | null;
  @text('table_name') tableName!: string | null;
  @text('status') status!: OrderStatus;
  @text('order_type') orderType!: OrderType;
  @field('total_amount') totalAmount!: number;
  @field('cgst_total') cgstTotal!: number;
  @field('sgst_total') sgstTotal!: number;
  @field('discount_amount') discountAmount!: number;
  @text('payment_mode') paymentMode!: PaymentMode | null;
  @field('amount_paid') amountPaid!: number | null;
  @field('amount_tendered') amountTendered!: number | null;
  @field('change_amount') changeAmount!: number | null;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('order_lines') lines: any;
  @children('kots') kots: any;
}
