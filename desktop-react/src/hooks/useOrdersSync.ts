import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchOrders } from '@/src/api/orders';
import type Order from '@/src/db/models/Order';

export function useOrdersSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['orders-sync'],
    queryFn: async () => {
      const result = await fetchOrders();
      const serverOrders = result.data ?? result;
      await db.write(async () => {
        for (const order of serverOrders) {
          const existing = await db
            .get<Order>('orders')
            .query(Q.where('server_id', order.id))
            .fetch();

          if (existing.length) {
            // Never overwrite local pending orders — mirror desktop SyncWorker pattern
            if (existing[0].syncStatus === 'pending') continue;
            await existing[0].update((r) => {
              r.status = order.status;
            });
          }
          // Don't create new rows from server pull — orders are created locally first
        }
      });
      return true;
    },
    staleTime: 60 * 1000,
  });
}
