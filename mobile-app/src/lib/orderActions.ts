import { database } from '@/db';
import { useCartStore } from '@/store/cartStore';
import type Order from '@/db/models/Order';
import type OrderLine from '@/db/models/OrderLine';
import type DiningTable from '@/db/models/DiningTable';
import { Q } from '@nozbe/watermelondb';
import * as ordersApi from '@/api/orders';
import Toast from 'react-native-toast-message';

function getCart() {
  return useCartStore.getState();
}

async function syncOrderToServer(localOrderId: string): Promise<void> {
  const order = await database.get<Order>('orders').find(localOrderId);
  const lines = await database.get<OrderLine>('order_lines').query(Q.where('order_id', localOrderId)).fetch();

  try {
    let serverOrderId = order.serverId;

    // Step 1: Create order on server if not yet created
    if (!serverOrderId) {
      const table = await database.get<DiningTable>('dining_tables').find(order.tableId);
      const serverOrder = await ordersApi.createOrder(table.serverId);
      serverOrderId = serverOrder.id ?? serverOrder.data?.id;
      await database.write(async () => {
        await order.update((r) => {
          r.serverId = serverOrderId!;
        });
        // Update cart store
        useCartStore.getState().setServerId(serverOrderId!);
      });
    }

    // Step 2: Push lines
    const linePayload = lines.map((l) => ({
      item_id: l.itemId,
      quantity: l.quantity,
      price: l.price,
      note: l.note ?? undefined,
    }));
    await ordersApi.addOrderLines(serverOrderId, linePayload);

    // Step 3: Send KOT
    await ordersApi.sendKot(serverOrderId);

    // Step 4: Mark synced
    await database.write(async () => {
      await order.update((r) => { r.syncStatus = 'synced'; });
    });
  } catch (err) {
    // Leave sync_status: 'pending' — will retry on next sync
    console.warn('[orderActions] sync failed, will retry:', err);
  }
}

export async function sendKot(): Promise<void> {
  const { table, lines, localOrderId, computeTotals } = getCart();
  if (!table) throw new Error('No table selected');

  const unsentLines = lines.filter((l) => !l.sent);
  if (unsentLines.length === 0) return;

  const { total } = computeTotals();

  let orderId = localOrderId;

  await database.write(async () => {
    if (!orderId) {
      // Create local order row
      const order = await database.get<Order>('orders').create((r) => {
        r.tableId = table.id;
        r.tableName = table.name;
        r.status = 'open';
        r.syncStatus = 'pending';
        r.totalAmount = total;
        r.createdAt = Date.now();
      });
      orderId = order.id;
      useCartStore.getState().setLocalOrderId(orderId);

      // Mark table as occupied
      const tableRow = await database.get<DiningTable>('dining_tables').find(table.id);
      await tableRow.update((r) => {
        r.status = 'occupied';
        r.currentOrderId = orderId!;
      });
    } else {
      // Update total on existing order
      const order = await database.get<Order>('orders').find(orderId);
      await order.update((r) => { r.totalAmount = total; });
    }

    // Write order lines
    for (const line of unsentLines) {
      await database.get<OrderLine>('order_lines').create((r) => {
        r.orderId = orderId!;
        r.itemId = line.itemId;
        r.itemName = line.itemName;
        r.quantity = line.quantity;
        r.price = line.price;
        r.note = line.note ?? null;
        r.sent = false;
      });
    }
  });

  // Mark lines as sent in cart store
  useCartStore.getState().markLinesSent();

  Toast.show({ type: 'success', text1: 'KOT Sent', text2: 'Order sent to kitchen.' });

  // Fire-and-forget sync to server
  syncOrderToServer(orderId!).catch(() => {});
}

export async function checkout(amountReceived: number): Promise<void> {
  const { table, localOrderId, computeTotals } = getCart();
  if (!table || !localOrderId) throw new Error('No active order');

  const { total } = computeTotals();

  // Write locally first
  await database.write(async () => {
    const order = await database.get<Order>('orders').find(localOrderId);
    await order.update((r) => {
      r.status = 'confirmed';
      r.totalAmount = total;
    });
    const tableRow = await database.get<DiningTable>('dining_tables').find(table.id);
    await tableRow.update((r) => {
      r.status = 'vacant';
      r.currentOrderId = null;
    });
  });

  useCartStore.getState().clearOrder();
  Toast.show({ type: 'success', text1: 'Checkout Complete', text2: `₹${total.toFixed(2)} received.` });

  // Fire-and-forget — sync order then checkout on server
  (async () => {
    try {
      const order = await database.get<Order>('orders').find(localOrderId);
      if (!order.serverId) {
        await syncOrderToServer(localOrderId);
      }
      if (order.serverId) {
        await ordersApi.checkoutOrder(order.serverId, amountReceived);
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
