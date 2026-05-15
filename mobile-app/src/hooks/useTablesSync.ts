import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchFloorPlans } from '@/api/tables';
import type FloorPlan from '@/db/models/FloorPlan';
import type DiningTable from '@/db/models/DiningTable';

export function useTablesSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['tables-sync'],
    queryFn: async () => {
      const floorPlans = await fetchFloorPlans();
      await db.write(async () => {
        for (const plan of floorPlans) {
          // Upsert floor plan
          const existingPlans = await db
            .get<FloorPlan>('floor_plans')
            .query(Q.where('server_id', plan.id))
            .fetch();
          let localPlan: FloorPlan;
          if (existingPlans.length) {
            await existingPlans[0].update((r) => { r.name = plan.name; });
            localPlan = existingPlans[0];
          } else {
            localPlan = await db.get<FloorPlan>('floor_plans').create((r) => {
              r.serverId = plan.id;
              r.name = plan.name;
            });
          }

          // Upsert each dining table in this plan
          for (const table of plan.dining_tables ?? []) {
            const existingTables = await db
              .get<DiningTable>('dining_tables')
              .query(Q.where('server_id', table.id))
              .fetch();
            if (existingTables.length) {
              await existingTables[0].update((r) => {
                r.name = table.name;
                r.status = table.status as DiningTable['status'];
                r.currentOrderId = table.current_order?.id ?? null;
              });
            } else {
              await db.get<DiningTable>('dining_tables').create((r) => {
                r.serverId = table.id;
                r.floorPlanId = localPlan.id; // local WatermelonDB id
                r.name = table.name;
                r.status = (table.status ?? 'vacant') as DiningTable['status'];
                r.currentOrderId = table.current_order?.id ?? null;
              });
            }
          }
        }
      });
      return true;
    },
    staleTime: 2 * 60 * 1000,
  });
}
