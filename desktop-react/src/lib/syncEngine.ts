import { queryClient } from './queryClient';
import { useSyncStore } from '@/src/store/syncStore';
import { database } from '@/src/db';
import { Q } from '@nozbe/watermelondb';
import type Order from '@/src/db/models/Order';
import * as ordersApi from '@/src/api/orders';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

async function pushPendingOrders(): Promise<void> {
  try {
    const pending = await database
      .get<Order>('orders')
      .query(Q.where('sync_status', 'pending'))
      .fetch();

    for (const order of pending) {
      try {
        if (!order.serverId) {
          const table = await database
            .get<any>('dining_tables')
            .find(order.tableId);
          const serverOrder = await ordersApi.createOrder(table.serverId);
          const serverOrderId = serverOrder.id ?? serverOrder.data?.id;
          await database.write(async () => {
            await order.update((r) => {
              r.serverId = serverOrderId;
              r.syncStatus = 'synced';
            });
          });
        }
      } catch (err) {
        console.warn('[syncEngine] push order failed:', err);
      }
    }
  } catch (err) {
    console.warn('[syncEngine] pushPendingOrders failed:', err);
  }
}

export async function runAllSyncs(): Promise<void> {
  const { setSyncing, setSynced, setError } = useSyncStore.getState();
  setSyncing();
  try {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['items-sync'] }),
      queryClient.refetchQueries({ queryKey: ['tables-sync'] }),
      queryClient.refetchQueries({ queryKey: ['variants-sync'] }),
      queryClient.refetchQueries({ queryKey: ['modifier-groups-sync'] }),
      queryClient.refetchQueries({ queryKey: ['units-sync'] }),
      queryClient.refetchQueries({ queryKey: ['combos-sync'] }),
      queryClient.refetchQueries({ queryKey: ['orders-sync'] }),
    ]);
    pushPendingOrders().catch(() => {});
    setSynced();
  } catch (err: any) {
    setError(err?.message ?? 'Sync failed');
  }
}

export function startSyncScheduler(): void {
  // Immediate sync on start
  runAllSyncs().catch(() => {});

  // 30-minute periodic sync (no AppState listener — Windows desktop doesn't background-suspend)
  syncIntervalId = setInterval(() => {
    runAllSyncs().catch(() => {});
  }, SYNC_INTERVAL_MS);
}

export function stopSyncScheduler(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
