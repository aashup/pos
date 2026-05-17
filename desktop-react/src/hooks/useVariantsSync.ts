import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchItemVariants } from '@/src/api/items';
import type ItemVariant from '@/src/db/models/ItemVariant';

export function useVariantsSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['variants-sync'],
    queryFn: async () => {
      let page = 1;
      let hasMore = true;
      const seenServerIds: string[] = [];

      while (hasMore) {
        const result = await fetchItemVariants(page);
        await db.write(async () => {
          for (const v of result.data) {
            seenServerIds.push(v.id);
            const existing = await db
              .get<ItemVariant>('item_variants')
              .query(Q.where('server_id', v.id))
              .fetch();
            if (existing.length) {
              if (existing[0].syncStatus === 'pending') continue; // preserve local unsynced changes
              await existing[0].update((r) => {
                r.itemServerId = v.item_id;
                r.name = v.name;
                r.price = v.price;
                r.isActive = v.is_active;
                r.syncStatus = 'synced';
              });
            } else {
              await db.get<ItemVariant>('item_variants').create((r) => {
                r.serverId = v.id;
                r.itemServerId = v.item_id;
                r.name = v.name;
                r.price = v.price;
                r.isActive = v.is_active;
                r.syncStatus = 'synced';
              });
            }
          }
        });
        hasMore = !!result.next_page_url;
        page++;
      }

      // Purge deleted (not in server response and not locally pending)
      const allLocal = await db
        .get<ItemVariant>('item_variants')
        .query(Q.where('sync_status', Q.notEq('pending')))
        .fetch();
      const toDelete = allLocal.filter((r) => !seenServerIds.includes(r.serverId));
      if (toDelete.length) {
        await db.write(async () => {
          for (const r of toDelete) await r.destroyPermanently();
        });
      }

      return true;
    },
    staleTime: 5 * 60 * 1000,
  });
}
