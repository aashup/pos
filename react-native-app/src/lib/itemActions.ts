import {database, itemsCollection, modifierGroupsCollection, modifiersCollection} from '@/src/db';
import Item from '@/src/db/models/Item';
import {itemsApi} from '@/src/api/items';
import {modifierGroupsApi} from '@/src/api/modifierGroups';

export type NewItemInput = {
  name: string;
  price: number;
  unit?: string | null;
  sku?: string | null;
  isActive?: boolean;
};

/**
 * Create an item locally (offline-first). Returns the local record immediately.
 * Server push happens fire-and-forget — failures stay 'pending' for the
 * next sync cycle to retry.
 */
export async function createItem(input: NewItemInput): Promise<Item> {
  let created!: Item;
  await database.write(async () => {
    created = await itemsCollection.create(rec => {
      rec.serverId = null;
      rec.name = input.name;
      rec.sku = input.sku ?? null;
      rec.price = input.price;
      rec.unit = input.unit ?? null;
      rec.isActive = input.isActive ?? true;
      rec.syncState = 'pending';
    });
  });

  // Fire-and-forget push to API
  void itemsApi
    .create({
      name: input.name,
      sku: input.sku ?? undefined,
      price: input.price,
      unit: input.unit ?? undefined,
      is_active: input.isActive ?? true,
    })
    .then(async remote => {
      await database.write(async () => {
        await created.update(rec => {
          rec.serverId = remote.id;
          rec.syncState = 'synced';
        });
      });
    })
    .catch(() => {
      // Stay 'pending' — sync engine will retry on next cycle
    });

  return created;
}

export type DraftModifier = {name: string; price: number};
export type DraftModifierGroup = {
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: DraftModifier[];
};

/**
 * Create an item with modifier groups in one go.
 * Requires network — modifier groups need the item's server ID before they can be created.
 */
export async function createItemWithModifiers(
  input: NewItemInput,
  groups: DraftModifierGroup[],
): Promise<Item> {
  // 1. Push item to server to get its ID
  const remoteItem = await itemsApi.create({
    name: input.name,
    sku: input.sku ?? undefined,
    price: input.price,
    unit: input.unit ?? undefined,
    is_active: input.isActive ?? true,
  });

  // 2. Push each modifier group + its modifiers sequentially
  const built: Array<{
    remoteGroupId: string;
    draft: DraftModifierGroup;
    remoteModifierIds: Array<{id: string; idx: number}>;
  }> = [];

  for (const group of groups) {
    const remoteGroup = await modifierGroupsApi.create({
      name: group.name,
      item_id: remoteItem.id,
      min_selections: group.minSelections,
      max_selections: group.maxSelections,
      is_required: group.isRequired,
    });

    const remoteModifierIds: Array<{id: string; idx: number}> = [];
    for (let i = 0; i < group.modifiers.length; i++) {
      const m = group.modifiers[i];
      const rm = await modifierGroupsApi.createModifier(remoteGroup.id, {
        name: m.name,
        price: m.price,
        sort_order: i,
      });
      remoteModifierIds.push({id: rm.id, idx: i});
    }

    built.push({remoteGroupId: remoteGroup.id, draft: group, remoteModifierIds});
  }

  // 3. Write everything to local DB in a single transaction
  let created!: Item;
  await database.write(async () => {
    created = await itemsCollection.create(rec => {
      rec.serverId = remoteItem.id;
      rec.name = input.name;
      rec.sku = input.sku ?? null;
      rec.price = input.price;
      rec.unit = input.unit ?? null;
      rec.isActive = input.isActive ?? true;
      rec.hasModifiers = groups.length > 0;
      rec.syncState = 'synced';
    });

    for (const {remoteGroupId, draft, remoteModifierIds} of built) {
      await modifierGroupsCollection.create(rec => {
        rec.serverId = remoteGroupId;
        rec.name = draft.name;
        rec.itemServerId = remoteItem.id;
        rec.minSelections = draft.minSelections;
        rec.maxSelections = draft.maxSelections;
        rec.isRequired = draft.isRequired;
        rec.syncState = 'synced';
      });

      for (const {id: modServerId, idx} of remoteModifierIds) {
        const m = draft.modifiers[idx];
        await modifiersCollection.create(rec => {
          rec.serverId = modServerId;
          rec.modifierGroupServerId = remoteGroupId;
          rec.name = m.name;
          rec.price = m.price;
          rec.sortOrder = idx;
          rec.isActive = true;
          rec.syncState = 'synced';
        });
      }
    }
  });

  return created;
}
