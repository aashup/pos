import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchUnits } from '@/api/items';
import type Unit from '@/db/models/Unit';

export function useUnitsSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['units-sync'],
    queryFn: async () => {
      const units = await fetchUnits();
      await db.write(async () => {
        for (const u of units) {
          const existing = await db
            .get<Unit>('units')
            .query(Q.where('server_id', u.id))
            .fetch();
          if (existing.length) {
            await existing[0].update((r) => {
              r.value = u.value;
              r.label = u.label;
              r.status = u.status;
            });
          } else {
            await db.get<Unit>('units').create((r) => {
              r.serverId = u.id;
              r.value = u.value;
              r.label = u.label;
              r.status = u.status;
            });
          }
        }
      });
      return true;
    },
    staleTime: 30 * 60 * 1000,
  });
}
