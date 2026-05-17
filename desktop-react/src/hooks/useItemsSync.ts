import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchItems, fetchItemGroups } from '@/src/api/items';
import type Item from '@/src/db/models/Item';
import type ItemGroup from '@/src/db/models/ItemGroup';

export function useItemsSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['items-sync'],
    queryFn: async () => {
      // Sync item groups first
      const groups = await fetchItemGroups();
      await db.write(async () => {
        for (const group of groups) {
          const existing = await db
            .get<ItemGroup>('item_groups')
            .query(Q.where('server_id', group.id))
            .fetch();
          if (existing.length) {
            await existing[0].update((r) => {
              r.name = group.name;
            });
          } else {
            await db.get<ItemGroup>('item_groups').create((r) => {
              r.serverId = group.id;
              r.name = group.name;
            });
          }
        }
      });

      // Sync items (paginated)
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await fetchItems(page);
        await db.write(async () => {
          for (const item of result.data) {
            const cgstPct = item.cgst ?? null;
            const sgstPct = item.sgst ?? null;
            const gstRate = cgstPct != null && sgstPct != null ? cgstPct + sgstPct : null;
            const existing = await db
              .get<Item>('items')
              .query(Q.where('server_id', item.id))
              .fetch();
            if (existing.length) {
              await existing[0].update((r) => {
                r.name = item.name;
                r.price = item.sale_price;
                r.barcode = item.barcode ?? null;
                r.isActive = item.is_active;
                r.cgstPct = cgstPct;
                r.sgstPct = sgstPct;
                r.gstRate = gstRate;
                r.unit = item.unit ?? null;
                r.sku = item.sku ?? null;
                r.hasVariants = (item.has_variants ?? 0) > 0;
                r.hasModifiers = (item.has_modifiers ?? 0) > 0;
                r.syncedAt = Date.now();
              });
            } else {
              await db.get<Item>('items').create((r) => {
                r.serverId = item.id;
                r.name = item.name;
                r.price = item.sale_price;
                r.barcode = item.barcode ?? null;
                r.itemGroupId = item.item_group_id;
                r.isActive = item.is_active;
                r.cgstPct = cgstPct;
                r.sgstPct = sgstPct;
                r.gstRate = gstRate;
                r.unit = item.unit ?? null;
                r.sku = item.sku ?? null;
                r.hasVariants = (item.has_variants ?? 0) > 0;
                r.hasModifiers = (item.has_modifiers ?? 0) > 0;
                r.syncedAt = Date.now();
              });
            }
          }
        });
        hasMore = !!result.next_page_url;
        page++;
      }
      return true;
    },
    staleTime: 5 * 60 * 1000,
  });
}
