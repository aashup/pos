import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { apiClient } from '@/src/api/client';
import type Combo from '@/src/db/models/Combo';
import type ComboItem from '@/src/db/models/ComboItem';

interface ApiComboItem {
  id: string;
  item_id: string;
  quantity: number;
}

interface ApiCombo {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  items?: ApiComboItem[];
}

async function fetchCombos(page = 1, perPage = 200) {
  const { data } = await apiClient.get('/combos', {
    params: { per_page: perPage, page },
  });
  return data as { data: ApiCombo[]; next_page_url: string | null };
}

export function useCombosSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['combos-sync'],
    queryFn: async () => {
      let page = 1;
      let hasMore = true;
      const seenServerIds: string[] = [];

      while (hasMore) {
        let result: { data: ApiCombo[]; next_page_url: string | null };
        try {
          result = await fetchCombos(page);
        } catch {
          // Combos endpoint may not exist — skip silently
          break;
        }
        await db.write(async () => {
          for (const combo of result.data) {
            seenServerIds.push(combo.id);
            const existingCombos = await db
              .get<Combo>('combos')
              .query(Q.where('server_id', combo.id))
              .fetch();

            let localCombo: Combo;
            if (existingCombos.length) {
              if (existingCombos[0].syncStatus !== 'pending') {
                await existingCombos[0].update((r) => {
                  r.name = combo.name;
                  r.price = combo.price;
                  r.isActive = combo.is_active;
                  r.syncStatus = 'synced';
                });
              }
              localCombo = existingCombos[0];
            } else {
              localCombo = await db.get<Combo>('combos').create((r) => {
                r.serverId = combo.id;
                r.name = combo.name;
                r.price = combo.price;
                r.isActive = combo.is_active;
                r.syncStatus = 'synced';
              });
            }

            // Sync combo items
            for (const ci of combo.items ?? []) {
              const existingCi = await db
                .get<ComboItem>('combo_items')
                .query(
                  Q.and(
                    Q.where('combo_server_id', localCombo.serverId),
                    Q.where('item_server_id', ci.item_id),
                  ),
                )
                .fetch();
              if (existingCi.length) {
                await existingCi[0].update((r) => { r.quantity = ci.quantity; });
              } else {
                await db.get<ComboItem>('combo_items').create((r) => {
                  r.serverId = ci.id ?? null;
                  r.comboServerId = localCombo.serverId;
                  r.itemServerId = ci.item_id;
                  r.quantity = ci.quantity;
                });
              }
            }
          }
        });
        hasMore = !!result.next_page_url;
        page++;
      }
      return true;
    },
    staleTime: 10 * 60 * 1000,
  });
}
