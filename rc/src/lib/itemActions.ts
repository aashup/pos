import {database, itemsCollection} from '@/src/db';
import Item from '@/src/db/models/Item';
import {itemsApi} from '@/src/api/items';

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
