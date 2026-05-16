import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { fetchModifierGroups } from '@/api/items';
import type ModifierGroup from '@/db/models/ModifierGroup';
import type Modifier from '@/db/models/Modifier';

export function useModifierGroupsSync() {
  const db = useDatabase();

  return useQuery({
    queryKey: ['modifier-groups-sync'],
    queryFn: async () => {
      let page = 1;
      let hasMore = true;
      const seenGroupServerIds: string[] = [];
      const seenModifierServerIds: string[] = [];

      while (hasMore) {
        const result = await fetchModifierGroups(page);
        await db.write(async () => {
          for (const group of result.data) {
            seenGroupServerIds.push(group.id);

            const existingGroups = await db
              .get<ModifierGroup>('modifier_groups')
              .query(Q.where('server_id', group.id))
              .fetch();

            let localGroup: ModifierGroup;
            if (existingGroups.length) {
              if (existingGroups[0].syncStatus !== 'pending') {
                await existingGroups[0].update((r) => {
                  r.name = group.name;
                  r.itemServerId = group.item_id ?? null;
                  r.minSelections = group.min_selections;
                  r.maxSelections = group.max_selections;
                  r.isRequired = group.is_required;
                  r.syncStatus = 'synced';
                });
              }
              localGroup = existingGroups[0];
            } else {
              localGroup = await db.get<ModifierGroup>('modifier_groups').create((r) => {
                r.serverId = group.id;
                r.name = group.name;
                r.itemServerId = group.item_id ?? null;
                r.minSelections = group.min_selections;
                r.maxSelections = group.max_selections;
                r.isRequired = group.is_required;
                r.syncStatus = 'synced';
              });
            }

            // Sync nested modifiers
            for (const mod of group.modifiers ?? []) {
              seenModifierServerIds.push(mod.id);
              const existingMods = await db
                .get<Modifier>('modifiers')
                .query(Q.where('server_id', mod.id))
                .fetch();
              if (existingMods.length) {
                if (existingMods[0].syncStatus === 'pending') continue;
                await existingMods[0].update((r) => {
                  r.modifierGroupId = localGroup.id;
                  r.name = mod.name;
                  r.price = mod.price;
                  r.sortOrder = mod.sort_order;
                  r.isActive = mod.is_active;
                  r.syncStatus = 'synced';
                });
              } else {
                await db.get<Modifier>('modifiers').create((r) => {
                  r.serverId = mod.id;
                  r.modifierGroupId = localGroup.id;
                  r.name = mod.name;
                  r.price = mod.price;
                  r.sortOrder = mod.sort_order;
                  r.isActive = mod.is_active;
                  r.syncStatus = 'synced';
                });
              }
            }
          }
        });
        hasMore = !!result.next_page_url;
        page++;
      }

      // Purge deleted groups (not pending)
      const allGroups = await db
        .get<ModifierGroup>('modifier_groups')
        .query(Q.where('sync_status', Q.notEq('pending')))
        .fetch();
      const groupsToDelete = allGroups.filter((r) => !seenGroupServerIds.includes(r.serverId));
      if (groupsToDelete.length) {
        await db.write(async () => {
          for (const r of groupsToDelete) await r.destroyPermanently();
        });
      }

      return true;
    },
    staleTime: 5 * 60 * 1000,
  });
}
