import { database } from '@/src/db';
import { Q } from '@nozbe/watermelondb';
import type Order from '@/src/db/models/Order';
import type OrderLine from '@/src/db/models/OrderLine';

function dayBounds(dateStr: string): { from: number; to: number } {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const from = d.getTime();
  d.setHours(23, 59, 59, 999);
  return { from, to: d.getTime() };
}

export interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalCgst: number;
  totalSgst: number;
  byOrderType: Record<string, { count: number; revenue: number }>;
  byPaymentMode: Record<string, { count: number; revenue: number }>;
  daily: Array<{ date: string; orders: number; revenue: number }>;
}

export async function computeSalesSummary(from: number, to: number): Promise<SalesSummary> {
  const orders = await database
    .get<Order>('orders')
    .query(
      Q.and(
        Q.where('status', 'confirmed'),
        Q.where('created_at', Q.gte(from)),
        Q.where('created_at', Q.lte(to)),
      ),
    )
    .fetch();

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalCgst = orders.reduce((s, o) => s + (o.cgstTotal ?? 0), 0);
  const totalSgst = orders.reduce((s, o) => s + (o.sgstTotal ?? 0), 0);

  const byOrderType: Record<string, { count: number; revenue: number }> = {};
  const byPaymentMode: Record<string, { count: number; revenue: number }> = {};
  const dailyMap: Record<string, { orders: number; revenue: number }> = {};

  for (const o of orders) {
    const type = o.orderType ?? 'dine_in';
    byOrderType[type] = byOrderType[type] ?? { count: 0, revenue: 0 };
    byOrderType[type].count++;
    byOrderType[type].revenue += o.totalAmount;

    const mode = o.paymentMode ?? 'cash';
    byPaymentMode[mode] = byPaymentMode[mode] ?? { count: 0, revenue: 0 };
    byPaymentMode[mode].count++;
    byPaymentMode[mode].revenue += o.totalAmount;

    const dateKey = new Date(o.createdAt).toISOString().slice(0, 10);
    dailyMap[dateKey] = dailyMap[dateKey] ?? { orders: 0, revenue: 0 };
    dailyMap[dateKey].orders++;
    dailyMap[dateKey].revenue += o.totalAmount;
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  return { totalOrders, totalRevenue, avgOrderValue, totalCgst, totalSgst, byOrderType, byPaymentMode, daily };
}

export interface DayClose {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  cgstTotal: number;
  sgstTotal: number;
  byPaymentMode: Record<string, number>;
  topItems: Array<{ itemName: string; quantity: number; revenue: number }>;
}

export async function computeDayClose(dateStr: string): Promise<DayClose> {
  const { from, to } = dayBounds(dateStr);

  const orders = await database
    .get<Order>('orders')
    .query(
      Q.and(
        Q.where('status', 'confirmed'),
        Q.where('created_at', Q.gte(from)),
        Q.where('created_at', Q.lte(to)),
      ),
    )
    .fetch();

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const cgstTotal = orders.reduce((s, o) => s + (o.cgstTotal ?? 0), 0);
  const sgstTotal = orders.reduce((s, o) => s + (o.sgstTotal ?? 0), 0);

  const byPaymentMode: Record<string, number> = {};
  for (const o of orders) {
    const mode = o.paymentMode ?? 'cash';
    byPaymentMode[mode] = (byPaymentMode[mode] ?? 0) + o.totalAmount;
  }

  // Top items from order lines
  const orderIds = orders.map((o) => o.id);
  const itemMap: Record<string, { itemName: string; quantity: number; revenue: number }> = {};

  if (orderIds.length > 0) {
    const lines = await database
      .get<OrderLine>('order_lines')
      .query(Q.where('order_id', Q.oneOf(orderIds)))
      .fetch();

    for (const l of lines) {
      const key = l.itemName;
      itemMap[key] = itemMap[key] ?? { itemName: l.itemName, quantity: 0, revenue: 0 };
      itemMap[key].quantity += l.quantity;
      itemMap[key].revenue += l.price * l.quantity;
    }
  }

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return { date: dateStr, totalOrders, totalRevenue, cgstTotal, sgstTotal, byPaymentMode, topItems };
}

export interface ItemWiseLine {
  itemName: string;
  quantity: number;
  orderCount: number;
  revenue: number;
}

export async function computeItemWise(from: number, to: number): Promise<ItemWiseLine[]> {
  const orders = await database
    .get<Order>('orders')
    .query(
      Q.and(
        Q.where('status', 'confirmed'),
        Q.where('created_at', Q.gte(from)),
        Q.where('created_at', Q.lte(to)),
      ),
    )
    .fetch();

  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const lines = await database
    .get<OrderLine>('order_lines')
    .query(Q.where('order_id', Q.oneOf(orderIds)))
    .fetch();

  const ordersByLineId: Record<string, string> = {};
  for (const l of lines) ordersByLineId[l.id] = l.orderId;

  const itemMap: Record<string, { itemName: string; quantity: number; orderIds: Set<string>; revenue: number }> = {};
  for (const l of lines) {
    const key = l.itemId + '|' + l.itemName;
    if (!itemMap[key]) {
      itemMap[key] = { itemName: l.itemName, quantity: 0, orderIds: new Set(), revenue: 0 };
    }
    itemMap[key].quantity += l.quantity;
    itemMap[key].orderIds.add(l.orderId);
    itemMap[key].revenue += l.price * l.quantity;
  }

  return Object.values(itemMap)
    .map((v) => ({ itemName: v.itemName, quantity: v.quantity, orderCount: v.orderIds.size, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface GstSummary {
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalTax: number;
  byRate: Array<{ rate: number; taxable: number; cgst: number; sgst: number; total: number }>;
}

export async function computeGstSummary(from: number, to: number): Promise<GstSummary> {
  const orders = await database
    .get<Order>('orders')
    .query(
      Q.and(
        Q.where('status', 'confirmed'),
        Q.where('created_at', Q.gte(from)),
        Q.where('created_at', Q.lte(to)),
      ),
    )
    .fetch();

  const orderIds = orders.map((o) => o.id);
  let totalCgst = 0;
  let totalSgst = 0;

  for (const o of orders) {
    totalCgst += o.cgstTotal ?? 0;
    totalSgst += o.sgstTotal ?? 0;
  }

  const byRate: Record<number, { taxable: number; cgst: number; sgst: number }> = {};

  if (orderIds.length > 0) {
    const lines = await database
      .get<OrderLine>('order_lines')
      .query(Q.where('order_id', Q.oneOf(orderIds)))
      .fetch();

    for (const l of lines) {
      const rate = l.gstRate ?? 0;
      const lineTotal = l.price * l.quantity;
      const cgstPct = rate / 2;
      const cgst = +(lineTotal * (cgstPct / 100)).toFixed(2);
      const sgst = cgst;
      const taxable = lineTotal - cgst - sgst;
      byRate[rate] = byRate[rate] ?? { taxable: 0, cgst: 0, sgst: 0 };
      byRate[rate].taxable += taxable;
      byRate[rate].cgst += cgst;
      byRate[rate].sgst += sgst;
    }
  }

  const byRateArr = Object.entries(byRate).map(([rate, v]) => ({
    rate: Number(rate),
    taxable: +v.taxable.toFixed(2),
    cgst: +v.cgst.toFixed(2),
    sgst: +v.sgst.toFixed(2),
    total: +(v.cgst + v.sgst).toFixed(2),
  }));

  const totalTaxable = byRateArr.reduce((s, r) => s + r.taxable, 0);
  return {
    totalTaxable,
    totalCgst: +totalCgst.toFixed(2),
    totalSgst: +totalSgst.toFixed(2),
    totalTax: +(totalCgst + totalSgst).toFixed(2),
    byRate: byRateArr.sort((a, b) => a.rate - b.rate),
  };
}
