import {Q} from '@nozbe/watermelondb';
import {
  database,
  itemsCollection,
  itemGroupsCollection,
  itemVariantsCollection,
  modifierGroupsCollection,
  modifiersCollection,
  unitsCollection,
  floorPlansCollection,
  diningTablesCollection,
  ordersCollection,
  orderLinesCollection,
  kotsCollection,
  combosCollection,
} from '@/src/db';

import {itemsApi, RemoteItem} from '@/src/api/items';
import {unitsApi, RemoteUnit} from '@/src/api/units';
import {itemGroupsApi, RemoteItemGroup} from '@/src/api/itemGroups';
import {itemVariantsApi, RemoteItemVariant} from '@/src/api/itemVariants';
import {
  modifierGroupsApi,
  RemoteModifier,
  RemoteModifierGroup,
} from '@/src/api/modifierGroups';
import {
  floorPlansApi,
  diningTablesApi,
  RemoteFloorPlan,
  RemoteDiningTable,
} from '@/src/api/tables';
import {ordersApi, RemoteOrder, RemoteOrderLine} from '@/src/api/orders';
import {kotsApi, RemoteKot} from '@/src/api/kots';
import {combosApi, RemoteCombo} from '@/src/api/combos';

import {useSyncStore} from '@/src/store/syncStore';
import {useAuthStore} from '@/src/store/authStore';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min
let intervalId: ReturnType<typeof setInterval> | null = null;

// ────────────────────────────────────────────────────────────────────────────
// Generic upsert helper
// Skip rows whose local copy is 'pending' so we never overwrite unsynced changes.
// ────────────────────────────────────────────────────────────────────────────
async function upsertCollection<TLocal extends {syncState: string}, TRemote extends {id: string}>(
  collection: any,
  remote: TRemote[],
  apply: (rec: any, r: TRemote) => void,
): Promise<number> {
  let n = 0;
  await database.write(async () => {
    for (const r of remote) {
      const found = await collection.query(Q.where('server_id', r.id)).fetch();
      const local: TLocal | undefined = found[0];
      if (local && local.syncState === 'pending') continue;
      if (local) {
        await (local as any).update((rec: any) => apply(rec, r));
      } else {
        await collection.create((rec: any) => apply(rec, r));
      }
      n++;
    }
  });
  return n;
}

// ────────────────────────────────────────────────────────────────────────────
// Pull each entity in dependency order
// ────────────────────────────────────────────────────────────────────────────
async function pullUnits(): Promise<number> {
  const remote = await unitsApi.list();
  return upsertCollection(unitsCollection, remote, (rec, r: RemoteUnit) => {
    rec.serverId = r.id;
    rec.value = r.value;
    rec.label = r.label;
    rec.status = r.status;
    rec.syncState = 'synced';
  });
}

async function pullItemGroups(): Promise<number> {
  const remote = await itemGroupsApi.list();
  return upsertCollection(itemGroupsCollection, remote, (rec, r: RemoteItemGroup) => {
    rec.serverId = r.id;
    rec.name = r.name;
    rec.syncState = 'synced';
  });
}

async function pullItems(): Promise<number> {
  const remote = await itemsApi.list({per_page: 200});
  return upsertCollection(itemsCollection, remote, (rec, r: RemoteItem) => {
    rec.serverId = r.id;
    rec.name = r.name;
    rec.sku = r.sku ?? null;
    rec.price = r.price;
    rec.unit = r.unit ?? null;
    rec.itemGroupServerId = (r as any).item_group_id ?? null;
    rec.imageUrl = (r as any).image_url ?? null;
    rec.cgstPct = (r as any).cgst_pct ?? null;
    rec.sgstPct = (r as any).sgst_pct ?? null;
    rec.hasVariants = !!(r as any).has_variants;
    rec.hasModifiers = !!(r as any).has_modifiers;
    rec.isActive = r.is_active;
    rec.syncState = 'synced';
  });
}

async function pullItemVariants(): Promise<number> {
  const remote = await itemVariantsApi.list();
  return upsertCollection(itemVariantsCollection, remote, (rec, r: RemoteItemVariant) => {
    rec.serverId = r.id;
    rec.itemServerId = r.item_id;
    rec.name = r.name;
    rec.price = r.price;
    rec.isActive = r.is_active;
    rec.syncState = 'synced';
  });
}

async function pullModifierGroupsAndModifiers(): Promise<number> {
  const remote = await modifierGroupsApi.list();
  const groupCount = await upsertCollection(
    modifierGroupsCollection,
    remote,
    (rec, r: RemoteModifierGroup) => {
      rec.serverId = r.id;
      rec.name = r.name;
      rec.itemServerId = r.item_id ?? null;
      rec.minSelections = r.min_selections;
      rec.maxSelections = r.max_selections;
      rec.isRequired = r.is_required;
      rec.syncState = 'synced';
    },
  );

  // Nested modifiers come embedded under each group; flatten and upsert
  const allModifiers: RemoteModifier[] = remote.flatMap(g =>
    (g.modifiers ?? []).map(m => ({...m, modifier_group_id: g.id})),
  );
  await upsertCollection(modifiersCollection, allModifiers, (rec, r: RemoteModifier) => {
    rec.serverId = r.id;
    rec.modifierGroupServerId = r.modifier_group_id;
    rec.name = r.name;
    rec.price = r.price;
    rec.sortOrder = r.sort_order ?? 0;
    rec.isActive = r.is_active;
    rec.syncState = 'synced';
  });
  return groupCount;
}

async function pullCombos(): Promise<number> {
  const remote = await combosApi.list();
  return upsertCollection(combosCollection, remote, (rec, r: RemoteCombo) => {
    rec.serverId = r.id;
    rec.name = r.name;
    rec.price = r.price;
    rec.isActive = r.is_active;
    rec.syncState = 'synced';
  });
}

async function pullFloorPlans(): Promise<number> {
  const remote = await floorPlansApi.list();
  return upsertCollection(floorPlansCollection, remote, (rec, r: RemoteFloorPlan) => {
    rec.serverId = r.id;
    rec.name = r.name;
    rec.syncState = 'synced';
  });
}

async function pullDiningTables(): Promise<number> {
  const remote = await diningTablesApi.list();
  return upsertCollection(diningTablesCollection, remote, (rec, r: RemoteDiningTable) => {
    rec.serverId = r.id;
    rec.floorPlanServerId = r.floor_plan_id;
    rec.name = r.name;
    rec.status = r.status;
    rec.currentOrderId = r.current_order_id ?? null;
    rec.syncState = 'synced';
  });
}

async function pullOrders(): Promise<number> {
  const remote = await ordersApi.list({per_page: 200});
  let n = 0;

  await database.write(async () => {
    for (const r of remote) {
      const existing = await ordersCollection
        .query(Q.where('server_id', r.id))
        .fetch();
      const local = existing[0];
      if (local && local.syncState === 'pending') continue;

      const applyOrder = (rec: any) => {
        rec.serverId = r.id;
        rec.tableId = r.table_id ?? null;
        rec.tableName = r.table_name ?? null;
        rec.status = r.status;
        rec.orderType = r.order_type;
        rec.totalAmount = r.total_amount ?? 0;
        rec.cgstTotal = r.cgst_total ?? 0;
        rec.sgstTotal = r.sgst_total ?? 0;
        rec.discountAmount = r.discount_amount ?? 0;
        rec.paymentMode = r.payment_mode ?? null;
        rec.amountPaid = r.amount_paid ?? null;
        rec.amountTendered = r.amount_tendered ?? null;
        rec.changeAmount = r.change_amount ?? null;
        rec.syncState = 'synced';
      };

      let orderRec: any;
      if (local) {
        await local.update(applyOrder);
        orderRec = local;
      } else {
        orderRec = await ordersCollection.create(applyOrder);
      }

      // Replace order_lines for this order with the server's snapshot.
      // (Order lines are read-only after KOT — server is authoritative.)
      const existingLines = await orderLinesCollection
        .query(Q.where('order_id', orderRec.id))
        .fetch();
      for (const line of existingLines) {
        await line.markAsDeleted();
      }
      for (const l of r.lines ?? []) {
        await orderLinesCollection.create((rec: any) => applyOrderLine(rec, l, orderRec.id));
      }
      n++;
    }
  });

  return n;
}

function applyOrderLine(rec: any, l: RemoteOrderLine, orderLocalId: string): void {
  rec.orderId = orderLocalId;
  rec.itemServerId = l.item_id;
  rec.itemName = l.item_name ?? '';
  rec.quantity = l.quantity ?? 0;
  rec.price = l.price ?? l.rate ?? 0;
  rec.note = l.notes ?? null;
  rec.kotStatus = (l.kot_status as any) ?? 'pending';
  rec.kotId = l.kot_id ?? null;
  rec.gstRate = l.gst_rate ?? null;
  rec.variantServerId = l.variant_id ?? null;
  rec.variantName = null;
  rec.modifiersTotal = l.modifiers_total ?? 0;
}

async function pullKots(): Promise<number> {
  const remote = await kotsApi.list();
  return upsertCollection(kotsCollection, remote, (rec, r: RemoteKot) => {
    rec.serverId = r.id;
    rec.orderId = r.order_id;
    rec.status = r.status;
    rec.syncState = 'synced';
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending — items only for now (orders are pushed inline via orderActions)
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingItems(): Promise<{pushed: number; failed: number}> {
  const pending = await itemsCollection
    .query(Q.where('sync_state', 'pending'))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const remote = await itemsApi.create({
        name: item.name,
        sku: item.sku ?? undefined,
        price: item.price,
        unit: item.unit ?? undefined,
        is_active: item.isActive,
      });
      await database.write(async () => {
        await item.update(rec => {
          rec.serverId = remote.id;
          rec.syncState = 'synced';
        });
      });
      pushed++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.log('[sync] push failed for item', item.id, err);
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ────────────────────────────────────────────────────────────────────────────
export async function runAllSyncs(): Promise<void> {
  const {setStatus, setLastSyncAt, setLastPulled, setLastPushed, pushError, clearErrors} =
    useSyncStore.getState();
  const {token, serverUrl} = useAuthStore.getState();

  if (!token || !serverUrl) return;

  setStatus('syncing');
  clearErrors();

  try {
    const {pushed} = await pushPendingItems();

    // Sequential — keep order so dependent tables are populated first
    let pulled = 0;
    pulled += await pullUnits();
    pulled += await pullItemGroups();
    pulled += await pullItems();
    pulled += await pullItemVariants();
    pulled += await pullModifierGroupsAndModifiers();
    pulled += await pullCombos();
    pulled += await pullFloorPlans();
    pulled += await pullDiningTables();
    pulled += await pullOrders();
    pulled += await pullKots();

    setLastPulled(pulled);
    setLastPushed(pushed);
    setLastSyncAt(Date.now());
    setStatus('idle');
    // eslint-disable-next-line no-console
    console.log(`[sync] OK: pushed ${pushed}, pulled ${pulled}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushError(msg);
    setStatus('error');
    // eslint-disable-next-line no-console
    console.log('[sync] failed:', msg);
  }
}

export function startSyncScheduler(): void {
  if (intervalId !== null) return;
  runAllSyncs().catch(() => {});
  intervalId = setInterval(() => {
    runAllSyncs().catch(() => {});
  }, SYNC_INTERVAL_MS);
}

export function stopSyncScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function triggerSyncNow(): void {
  runAllSyncs().catch(() => {});
}
