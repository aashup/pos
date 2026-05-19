import {Q} from '@nozbe/watermelondb';
import {
  database,
  ordersCollection,
  orderLinesCollection,
  kotsCollection,
  diningTablesCollection,
} from '@/src/db';
import Order from '@/src/db/models/Order';
import {useCartStore, CartLine, OrderType} from '@/src/store/cartStore';
import {ordersApi, CheckoutPayload} from '@/src/api/orders';
import {kotsApi} from '@/src/api/kots';
import {usePrinterStore} from '@/src/store/printerStore';
import {printKot as _printKot, printReceipt as _printReceipt} from '@/src/lib/printer';

// ────────────────────────────────────────────────────────────────────────────
// 1. Start order — create a local 'open' Order row and bind cartStore to it.
// ────────────────────────────────────────────────────────────────────────────
export async function startOrder(args: {
  orderType: OrderType;
  tableServerId?: string | null;
  tableName?: string | null;
}): Promise<Order> {
  let created!: Order;
  await database.write(async () => {
    created = await ordersCollection.create((rec: any) => {
      rec.serverId = null;
      rec.tableId = args.tableServerId ?? null;
      rec.tableName = args.tableName ?? null;
      rec.status = 'open';
      rec.orderType = args.orderType;
      rec.totalAmount = 0;
      rec.cgstTotal = 0;
      rec.sgstTotal = 0;
      rec.discountAmount = 0;
      rec.syncState = 'pending';
    });
  });
  useCartStore.getState().setLocalOrderId(created.id);
  return created;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Resume an existing order — populate cart from order_lines.
// ────────────────────────────────────────────────────────────────────────────
export async function resumeOrder(orderId: string): Promise<void> {
  const order = await ordersCollection.find(orderId);
  const lines = await orderLinesCollection
    .query(Q.where('order_id', orderId))
    .fetch();

  const cartLines: CartLine[] = lines.map(l => ({
    lineId: l.id,
    itemId: (l as any).itemServerId,
    itemName: (l as any).itemName,
    price: (l as any).price,
    quantity: (l as any).quantity,
    note: (l as any).note,
    sent: (l as any).kotStatus !== 'pending',
    kotStatus: (l as any).kotStatus,
    cgstPct: 0,
    sgstPct: 0,
    variantId: (l as any).variantServerId ?? null,
    variantName: (l as any).variantName ?? null,
    selectedModifiers: [],
    modifiersTotal: (l as any).modifiersTotal ?? 0,
  }));

  useCartStore.getState().populateLines(cartLines, order.id);
  useCartStore.setState({
    serverId: (order as any).serverId ?? null,
    orderType: (order as any).orderType,
    table:
      (order as any).tableId && (order as any).tableName
        ? {
            id: (order as any).tableId,
            serverId: (order as any).tableId,
            name: (order as any).tableName,
          }
        : null,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Find an active order for a table (used when tapping an occupied table).
// ────────────────────────────────────────────────────────────────────────────
export async function findActiveOrderForTable(
  tableServerId: string,
): Promise<Order | null> {
  const matches = await ordersCollection
    .query(
      Q.where('table_id', tableServerId),
      Q.where('status', Q.oneOf(['open', 'held'])),
    )
    .fetch();
  return matches[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Send KOT — flush pending Zustand lines into order_lines + kots tables,
//    flip cart `sent=true`, fire-and-forget server push.
// ────────────────────────────────────────────────────────────────────────────
export async function sendKot(): Promise<void> {
  const cart = useCartStore.getState();
  const {localOrderId, lines, table, orderType} = cart;
  if (!localOrderId) throw new Error('No active order');

  const unsent = lines.filter(l => !l.sent);
  if (unsent.length === 0) return;

  // 1. Write order_lines + kot locally — atomic
  let localKotId!: string;
  await database.write(async () => {
    const kot = await kotsCollection.create((rec: any) => {
      rec.serverId = null;
      rec.orderId = localOrderId;
      rec.status = 'new';
      rec.syncState = 'pending';
    });
    localKotId = kot.id;

    for (const line of unsent) {
      await orderLinesCollection.create((rec: any) => {
        rec.orderId = localOrderId;
        rec.itemServerId = line.itemId;
        rec.itemName = line.itemName;
        rec.quantity = line.quantity;
        rec.price = line.price;
        rec.note = line.note;
        rec.kotStatus = 'sent';
        rec.kotId = kot.id;
        rec.gstRate = (line.cgstPct ?? 0) + (line.sgstPct ?? 0);
        rec.variantServerId = line.variantId ?? null;
        rec.variantName = line.variantName ?? null;
        rec.modifiersTotal = line.modifiersTotal ?? 0;
      });
    }
  });

  // 2. Optimistically flip cart UI
  cart.markLinesSent();

  // 2b. Auto-print KOT if enabled
  if (usePrinterStore.getState().autoPrintKot) {
    _printKot(localKotId).catch(e =>
      console.log('[orderActions] auto-print KOT failed:', e),
    );
  }

  // 3. Fire-and-forget server push — token + serverUrl picked up by axios interceptor
  setTimeout(async () => {
    try {
      // Ensure the order exists on the server
      const order = await ordersCollection.find(localOrderId);
      let serverOrderId = (order as any).serverId as string | null;
      if (!serverOrderId) {
        const remote = await ordersApi.create({
          order_type: orderType,
          table_id: table?.serverId ?? undefined,
        });
        serverOrderId = remote.id;
        await database.write(async () => {
          await order.update((rec: any) => {
            rec.serverId = serverOrderId;
          });
        });
      }

      // Push the unsynced lines
      await ordersApi.addLines(serverOrderId!, {
        lines: unsent.map(l => ({
          item_id: l.itemId,
          quantity: l.quantity,
          rate: l.price,
          gst_rate: (l.cgstPct ?? 0) + (l.sgstPct ?? 0),
          notes: l.note ?? undefined,
          item_variant_id: l.variantId ?? null,
          modifiers_total: l.modifiersTotal ?? 0,
        })),
      });

      // Generate the KOT on the server
      const remoteKot = await ordersApi.generateKot(serverOrderId!);
      await database.write(async () => {
        const kot = await kotsCollection.find(localKotId);
        await kot.update((rec: any) => {
          rec.serverId = remoteKot.id;
          rec.syncState = 'synced';
        });
        await order.update((rec: any) => {
          rec.syncState = 'synced';
        });
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[orderActions] sendKot push failed:', err);
    }
  }, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Hold / Unhold / Cancel — local write + fire-and-forget API call.
// ────────────────────────────────────────────────────────────────────────────
async function setOrderStatus(localOrderId: string, status: Order['status']): Promise<void> {
  await database.write(async () => {
    const order = await ordersCollection.find(localOrderId);
    await order.update((rec: any) => {
      rec.status = status;
      rec.syncState = (rec as any).serverId ? 'pending' : 'pending';
    });
  });
}

export async function holdOrder(localOrderId: string): Promise<void> {
  await setOrderStatus(localOrderId, 'held');
  setTimeout(async () => {
    try {
      const order = await ordersCollection.find(localOrderId);
      const sid = (order as any).serverId;
      if (sid) await ordersApi.hold(sid);
    } catch {
      // retried on next sync push (not implemented yet)
    }
  }, 0);
}

export async function unholdOrder(localOrderId: string): Promise<void> {
  await setOrderStatus(localOrderId, 'open');
  setTimeout(async () => {
    try {
      const order = await ordersCollection.find(localOrderId);
      const sid = (order as any).serverId;
      if (sid) await ordersApi.unhold(sid);
    } catch {}
  }, 0);
}

export async function cancelOrder(localOrderId: string): Promise<void> {
  await setOrderStatus(localOrderId, 'cancelled');
  setTimeout(async () => {
    try {
      const order = await ordersCollection.find(localOrderId);
      const sid = (order as any).serverId;
      if (sid) await ordersApi.cancel(sid);
    } catch {}
  }, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Checkout — record payment locally, push to server, clear cart.
// ────────────────────────────────────────────────────────────────────────────
export type CheckoutData = CheckoutPayload & {
  total_amount: number;
  cgst_total: number;
  sgst_total: number;
  amount_paid: number;
  change_amount: number;
};

export async function checkoutOrder(
  localOrderId: string,
  data: CheckoutData,
): Promise<void> {
  // Local write — atomic
  await database.write(async () => {
    const order = await ordersCollection.find(localOrderId);
    await order.update((rec: any) => {
      rec.status = 'confirmed';
      rec.totalAmount = data.total_amount;
      rec.cgstTotal = data.cgst_total;
      rec.sgstTotal = data.sgst_total;
      rec.discountAmount = (data as any).discount_amount ?? 0;
      rec.paymentMode = data.payment_mode;
      rec.amountPaid = data.amount_paid;
      rec.amountTendered = (data as any).amount_tendered ?? null;
      rec.changeAmount = data.change_amount;
      rec.syncState = 'pending';
    });
  });

  // Fire-and-forget server checkout
  setTimeout(async () => {
    try {
      const order = await ordersCollection.find(localOrderId);
      const sid = (order as any).serverId;
      if (!sid) return; // server order doesn't exist (no KOT was sent) — skip
      await ordersApi.checkout(sid, data);
      await database.write(async () => {
        await order.update((rec: any) => {
          rec.syncState = 'synced';
        });
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[orderActions] checkout push failed:', err);
    }
  }, 0);

  // Auto-print receipt if enabled
  if (usePrinterStore.getState().autoPrintReceipt) {
    _printReceipt(localOrderId).catch(e =>
      console.log('[orderActions] auto-print receipt failed:', e),
    );
  }

  // Reset cart
  useCartStore.getState().clearOrder();
}

// ────────────────────────────────────────────────────────────────────────────
// 7. KOT status advance — used by Kitchen kanban (Phase 3 but cheap to add now)
// ────────────────────────────────────────────────────────────────────────────
const NEXT_KOT_STATUS: Record<string, string> = {
  new: 'in_progress',
  in_progress: 'ready',
  ready: 'served',
};

export async function advanceKotStatus(kotLocalId: string): Promise<void> {
  await database.write(async () => {
    const kot = await kotsCollection.find(kotLocalId);
    const next = NEXT_KOT_STATUS[(kot as any).status] ?? 'served';
    await kot.update((rec: any) => {
      rec.status = next;
    });
  });
  setTimeout(async () => {
    try {
      const kot = await kotsCollection.find(kotLocalId);
      const sid = (kot as any).serverId;
      if (sid) await kotsApi.updateStatus(sid, (kot as any).status);
    } catch {}
  }, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// 8. Mark a dining table as occupied/vacant locally (UI feedback).
// ────────────────────────────────────────────────────────────────────────────
export async function setTableStatusLocal(
  tableLocalId: string,
  status: 'vacant' | 'occupied' | 'reserved' | 'cleaning',
): Promise<void> {
  await database.write(async () => {
    const t = await diningTablesCollection.find(tableLocalId);
    await t.update((rec: any) => {
      rec.status = status;
    });
  });
}
