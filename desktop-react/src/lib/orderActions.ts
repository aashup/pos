import { database } from '@/src/db';
import { useCartStore } from '@/src/store/cartStore';
import type Order from '@/src/db/models/Order';
import type OrderLine from '@/src/db/models/OrderLine';
import type DiningTable from '@/src/db/models/DiningTable';
import type Kot from '@/src/db/models/Kot';
import { Q } from '@nozbe/watermelondb';
import * as ordersApi from '@/src/api/orders';
import * as kotsApi from '@/src/api/kots';
import Toast from 'react-native-toast-message';

function getCart() {
  return useCartStore.getState();
}

async function syncOrderToServer(localOrderId: string): Promise<string | null> {
  const order = await database.get<Order>('orders').find(localOrderId);
  const lines = await database
    .get<OrderLine>('order_lines')
    .query(Q.where('order_id', localOrderId))
    .fetch();

  try {
    let serverOrderId = order.serverId;

    if (!serverOrderId) {
      const table = await database.get<DiningTable>('dining_tables').find(order.tableId);
      const serverOrder = await ordersApi.createOrder(table.serverId);
      serverOrderId = serverOrder.id ?? serverOrder.data?.id;
      await database.write(async () => {
        await order.update((r) => {
          r.serverId = serverOrderId!;
          r.syncStatus = 'synced';
        });
        useCartStore.getState().setServerId(serverOrderId!);
      });
    }

    const linePayload = lines.map((l) => ({
      item_id: l.itemId,
      quantity: l.quantity,
      price: l.price,
      note: l.note ?? undefined,
      variant_id: l.variantId ?? undefined,
      variant_name: l.variantName ?? undefined,
    }));
    await ordersApi.addOrderLines(serverOrderId!, linePayload);
    await ordersApi.sendKot(serverOrderId!);

    await database.write(async () => {
      await order.update((r) => { r.syncStatus = 'synced'; });
    });

    return serverOrderId!;
  } catch (err) {
    console.warn('[orderActions] sync failed, will retry:', err);
    return null;
  }
}

export async function sendKot(): Promise<void> {
  const { table, lines, localOrderId, computeTotals, orderType } = getCart();
  if (!table) throw new Error('No table selected');

  const unsentLines = lines.filter((l) => !l.sent);
  if (unsentLines.length === 0) return;

  const { netPayable } = computeTotals();

  let orderId = localOrderId;
  let kotLocalId: string | null = null;

  await database.write(async () => {
    if (!orderId) {
      const order = await database.get<Order>('orders').create((r) => {
        r.tableId = table.id;
        r.tableName = table.name;
        r.status = 'open';
        r.syncStatus = 'pending';
        r.totalAmount = netPayable;
        r.createdAt = Date.now();
        r.orderType = orderType;
      });
      orderId = order.id;
      useCartStore.getState().setLocalOrderId(orderId);

      const tableRow = await database.get<DiningTable>('dining_tables').find(table.id);
      await tableRow.update((r) => {
        r.status = 'occupied';
        r.currentOrderId = orderId!;
      });
    } else {
      const order = await database.get<Order>('orders').find(orderId);
      await order.update((r) => { r.totalAmount = netPayable; });
    }

    // Create KOT record
    const kot = await database.get<Kot>('kots').create((r) => {
      r.orderId = orderId!;
      r.status = 'new';
      r.createdAt = Date.now();
      r.syncStatus = 'pending';
    });
    kotLocalId = kot.id;

    // Write order lines linked to KOT
    for (const line of unsentLines) {
      await database.get<OrderLine>('order_lines').create((r) => {
        r.orderId = orderId!;
        r.kotId = kotLocalId;
        r.itemId = line.itemId;
        r.itemName = line.itemName;
        r.quantity = line.quantity;
        r.price = line.price;
        r.note = line.note ?? null;
        r.sent = true;
        r.kotStatus = 'sent';
        r.gstRate = (line.cgstPct ?? 0) + (line.sgstPct ?? 0);
        r.variantId = line.variantId ?? null;
        r.variantName = line.variantName ?? null;
        r.modifiersTotal = line.modifiersTotal ?? 0;
      });
    }
  });

  useCartStore.getState().markLinesSent();
  Toast.show({ type: 'success', text1: 'KOT Sent', text2: 'Order sent to kitchen.' });

  // Fire-and-forget
  syncOrderToServer(orderId!).catch(() => {});
}

export interface PaymentData {
  paymentMode: string;
  amountPaid: number;
  amountTendered?: number;
  changeAmount?: number;
  cgstTotal: number;
  sgstTotal: number;
  discountAmount?: number;
  splitPayments?: Array<{ mode: string; amount: number }>;
}

export async function checkout(paymentData: PaymentData): Promise<void> {
  const { table, localOrderId, computeTotals } = getCart();
  if (!table || !localOrderId) throw new Error('No active order');

  const { netPayable, cgstTotal, sgstTotal } = computeTotals();

  await database.write(async () => {
    const order = await database.get<Order>('orders').find(localOrderId);
    await order.update((r) => {
      r.status = 'confirmed';
      r.totalAmount = netPayable;
      r.paymentMode = paymentData.paymentMode;
      r.amountPaid = paymentData.amountPaid;
      r.amountTendered = paymentData.amountTendered ?? paymentData.amountPaid;
      r.changeAmount = paymentData.changeAmount ?? 0;
      r.cgstTotal = cgstTotal;
      r.sgstTotal = sgstTotal;
      r.discountAmount = paymentData.discountAmount ?? 0;
    });
    const tableRow = await database.get<DiningTable>('dining_tables').find(table.id);
    await tableRow.update((r) => {
      r.status = 'vacant';
      r.currentOrderId = null;
    });
  });

  useCartStore.getState().clearOrder();
  Toast.show({ type: 'success', text1: 'Checkout Complete', text2: `₹${netPayable.toFixed(2)} received.` });

  // Fire-and-forget server push
  (async () => {
    try {
      const order = await database.get<Order>('orders').find(localOrderId);
      let serverOrderId = order.serverId;
      if (!serverOrderId) {
        serverOrderId = await syncOrderToServer(localOrderId);
      }
      if (serverOrderId) {
        await ordersApi.checkoutOrder(serverOrderId, paymentData.amountPaid);
      }
    } catch (err) {
      console.warn('[orderActions] checkout sync failed:', err);
    }
  })();
}

export async function holdOrder(): Promise<void> {
  const { localOrderId, table } = getCart();
  if (!localOrderId || !table) return;

  await database.write(async () => {
    const order = await database.get<Order>('orders').find(localOrderId);
    await order.update((r) => { r.status = 'held'; });
    const tableRow = await database.get<DiningTable>('dining_tables').find(table.id);
    await tableRow.update((r) => { r.status = 'reserved'; });
  });

  useCartStore.getState().clearOrder();
  Toast.show({ type: 'info', text1: 'Order Held' });

  (async () => {
    try {
      const order = await database.get<Order>('orders').find(localOrderId);
      if (order.serverId) await ordersApi.holdOrder(order.serverId);
    } catch {}
  })();
}

export async function cancelOrder(localOrderId: string): Promise<void> {
  const order = await database.get<Order>('orders').find(localOrderId);

  await database.write(async () => {
    await order.update((r) => { r.status = 'cancelled'; });
    if (order.tableId) {
      const tables = await database
        .get<DiningTable>('dining_tables')
        .query(Q.where('current_order_id', localOrderId))
        .fetch();
      for (const t of tables) {
        await t.update((r) => {
          r.status = 'vacant';
          r.currentOrderId = null;
        });
      }
    }
  });

  Toast.show({ type: 'success', text1: 'Order Cancelled' });

  (async () => {
    try {
      const fresh = await database.get<Order>('orders').find(localOrderId);
      if (fresh.serverId) await ordersApi.cancelOrder(fresh.serverId);
    } catch {}
  })();
}

export async function unholdOrder(localOrderId: string): Promise<void> {
  const order = await database.get<Order>('orders').find(localOrderId);
  const lines = await database
    .get<OrderLine>('order_lines')
    .query(Q.where('order_id', localOrderId))
    .fetch();

  await database.write(async () => {
    await order.update((r) => { r.status = 'open'; });
    if (order.tableId) {
      const tables = await database.get<DiningTable>('dining_tables').query(Q.where('id', order.tableId)).fetch();
      for (const t of tables) {
        await t.update((r) => {
          r.status = 'occupied';
          r.currentOrderId = localOrderId;
        });
      }
    }
  });

  // Load order into cart
  const tableRows = await database.get<DiningTable>('dining_tables').query(Q.where('id', order.tableId)).fetch();
  const tableRow = tableRows[0];
  if (tableRow) {
    useCartStore.getState().setTable({
      id: tableRow.id,
      serverId: tableRow.serverId,
      name: tableRow.name,
    });
  }

  const cartLines = lines.map((l) => ({
    lineId: l.id,
    itemId: l.itemId,
    itemName: l.itemName,
    price: l.price,
    quantity: l.quantity,
    note: l.note ?? null,
    sent: l.sent,
    kotStatus: l.kotStatus ?? (l.sent ? 'sent' : 'pending'),
    cgstPct: 0,
    sgstPct: 0,
    variantId: l.variantId ?? null,
    variantName: l.variantName ?? null,
    selectedModifiers: [],
    modifiersTotal: l.modifiersTotal ?? 0,
  }));
  useCartStore.getState().populateLines(cartLines as any, localOrderId);
  useCartStore.getState().setServerId(order.serverId ?? '');

  (async () => {
    try {
      const fresh = await database.get<Order>('orders').find(localOrderId);
      if (fresh.serverId) await ordersApi.unholdOrder(fresh.serverId);
    } catch {}
  })();
}

export async function resumeOrderIntoCart(localOrderId: string): Promise<void> {
  const order = await database.get<Order>('orders').find(localOrderId);
  const lines = await database
    .get<OrderLine>('order_lines')
    .query(Q.where('order_id', localOrderId))
    .fetch();

  const tableRows = await database.get<DiningTable>('dining_tables').query(Q.where('id', order.tableId)).fetch();
  const tableRow = tableRows[0];
  if (tableRow) {
    useCartStore.getState().setTable({
      id: tableRow.id,
      serverId: tableRow.serverId,
      name: tableRow.name,
    });
  }

  const cartLines = lines.map((l) => ({
    lineId: l.id,
    itemId: l.itemId,
    itemName: l.itemName,
    price: l.price,
    quantity: l.quantity,
    note: l.note ?? null,
    sent: l.sent,
    kotStatus: l.kotStatus ?? (l.sent ? 'sent' : 'pending'),
    cgstPct: 0,
    sgstPct: 0,
    variantId: l.variantId ?? null,
    variantName: l.variantName ?? null,
    selectedModifiers: [],
    modifiersTotal: l.modifiersTotal ?? 0,
  }));
  useCartStore.getState().populateLines(cartLines as any, localOrderId);
  if (order.serverId) useCartStore.getState().setServerId(order.serverId);
}

export async function updateKotStatus(
  kotLocalId: string,
  status: 'new' | 'in_progress' | 'ready' | 'served',
): Promise<void> {
  const kot = await database.get<Kot>('kots').find(kotLocalId);
  await database.write(async () => {
    await kot.update((r) => { r.status = status; });
  });

  (async () => {
    try {
      const fresh = await database.get<Kot>('kots').find(kotLocalId);
      if (fresh.serverId) await kotsApi.updateKotStatus(fresh.serverId, status);
    } catch {}
  })();
}
