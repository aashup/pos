import {AppState, AppStateStatus} from 'react-native';
import {Q} from '@nozbe/watermelondb';
import {
  database,
  itemsCollection,
  itemVariantsCollection,
  floorPlansCollection,
  diningTablesCollection,
  ordersCollection,
  orderLinesCollection,
  kotsCollection,
  combosCollection,
  itemGroupsCollection,
  modifierGroupsCollection,
  modifiersCollection,
  unitsCollection,
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

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 min
let intervalId: ReturnType<typeof setInterval> | null = null;

// Track whether the app is in the foreground — sync is skipped when backgrounded.
let appIsActive = AppState.currentState === 'active';
AppState.addEventListener('change', (next: AppStateStatus) => {
  appIsActive = next === 'active';
});

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
    rec.capacity = r.capacity ?? 4;
    rec.isActive = r.is_active ?? true;
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
// Push pending items (create + update + cascade variant itemServerId)
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingItems(): Promise<{pushed: number; failed: number}> {
  const pending = await itemsCollection
    .query(Q.where('sync_state', 'pending'))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const isNew = !item.serverId || item.serverId.startsWith('local_');
      const payload = {
        name: item.name,
        sku: item.sku ?? undefined,
        price: item.price,
        unit: item.unit ?? undefined,
        cgst_pct: item.cgstPct ?? undefined,
        sgst_pct: item.sgstPct ?? undefined,
        item_group_id: item.itemGroupServerId ?? undefined,
        is_active: item.isActive,
      };

      if (isNew) {
        const remote = await itemsApi.create(payload);
        const oldLocalId = item.serverId;
        await database.write(async () => {
          await item.update((rec: any) => {
            rec.serverId = remote.id;
            rec.syncState = 'synced';
          });
          // Cascade: update variants whose itemServerId pointed at the local placeholder
          if (oldLocalId) {
            const related = await itemVariantsCollection
              .query(Q.where('item_server_id', oldLocalId))
              .fetch();
            for (const v of related) {
              await v.update((rec: any) => {rec.itemServerId = remote.id;});
            }
          }
        });
      } else {
        await itemsApi.update(item.serverId!, payload);
        await database.write(async () => {
          await item.update((rec: any) => {rec.syncState = 'synced';});
        });
      }
      pushed++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.log('[sync] push item failed', item.id, err);
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending item variants (create new + delete marked)
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingItemVariants(): Promise<{pushed: number; failed: number}> {
  const newVariants = await itemVariantsCollection
    .query(Q.and(Q.where('sync_state', 'pending'), Q.where('is_active', true)))
    .fetch();

  // 'deleted' is used as a soft-delete marker before markAsDeleted()
  const deletedVariants = await itemVariantsCollection
    .query(Q.where('sync_state', 'deleted' as any))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const v of newVariants) {
    const sid = (v as any).serverId as string | null;
    if (!sid || !sid.startsWith('local_')) continue; // already has a real server ID

    const itemSid = (v as any).itemServerId as string;
    if (!itemSid || itemSid.startsWith('local_')) {
      failed++; // parent item not yet pushed — will retry on next sync
      continue;
    }
    try {
      const remote = await itemVariantsApi.create({
        item_id: itemSid,
        name: v.name,
        price: v.price,
      });
      await database.write(async () => {
        await v.update((rec: any) => {
          rec.serverId = remote.id;
          rec.syncState = 'synced';
        });
      });
      pushed++;
    } catch {
      failed++;
    }
  }

  for (const v of deletedVariants) {
    const sid = (v as any).serverId as string | null;
    if (!sid || sid.startsWith('local_')) {
      // Never reached the server — just purge locally
      await database.write(async () => {await v.markAsDeleted();});
      pushed++;
      continue;
    }
    try {
      await itemVariantsApi.delete(sid);
      await database.write(async () => {await v.markAsDeleted();});
      pushed++;
    } catch {
      failed++;
    }
  }

  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending floor plans (create + update, cascade table floorPlanServerId)
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingFloorPlans(): Promise<{pushed: number; failed: number}> {
  const pending = await floorPlansCollection
    .query(Q.where('sync_state', 'pending'))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const fp of pending) {
    try {
      const isNew = !fp.serverId || fp.serverId.startsWith('local_');
      if (isNew) {
        const remote = await floorPlansApi.create({name: fp.name});
        const oldLocalId = fp.serverId;
        await database.write(async () => {
          await fp.update((rec: any) => {
            rec.serverId = remote.id;
            rec.syncState = 'synced';
          });
          // Cascade: fix dining tables that referenced the local placeholder
          if (oldLocalId) {
            const related = await diningTablesCollection
              .query(Q.where('floor_plan_server_id', oldLocalId))
              .fetch();
            for (const t of related) {
              await t.update((rec: any) => {rec.floorPlanServerId = remote.id;});
            }
          }
        });
      } else {
        await floorPlansApi.update(fp.serverId!, {name: fp.name});
        await database.write(async () => {
          await fp.update((rec: any) => {rec.syncState = 'synced';});
        });
      }
      pushed++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.log('[sync] push floor plan failed:', err);
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending dining tables (create + update)
// Tables whose parent floor plan is still local are deferred to next sync.
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingDiningTables(): Promise<{pushed: number; failed: number}> {
  const pending = await diningTablesCollection
    .query(Q.where('sync_state', 'pending'))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const t of pending) {
    try {
      const isNew = !t.serverId || t.serverId.startsWith('local_');
      if (isNew) {
        // Parent floor plan must have a real server ID before we can create the table
        if (!t.floorPlanServerId || t.floorPlanServerId.startsWith('local_')) {
          failed++; // deferred — parent floor plan not yet pushed
          continue;
        }
        const remote = await diningTablesApi.create({
          floor_plan_id: t.floorPlanServerId,
          name: t.name,
          capacity: t.capacity,
        });
        await database.write(async () => {
          await t.update((rec: any) => {
            rec.serverId = remote.id;
            rec.syncState = 'synced';
          });
        });
      } else {
        await diningTablesApi.update(t.serverId!, {
          name: t.name,
          capacity: t.capacity,
          is_active: t.isActive,
        });
        await database.write(async () => {
          await t.update((rec: any) => {rec.syncState = 'synced';});
        });
      }
      pushed++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.log('[sync] push dining table failed:', err);
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending orders (hold / unhold / cancel / checkout retries)
// Only orders that already have a server ID are retried here.
// Orders without a server ID are created inline during sendKot.
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingOrders(): Promise<{pushed: number; failed: number}> {
  const pending = await ordersCollection
    .query(
      Q.and(
        Q.where('sync_state', 'pending'),
        Q.where('server_id', Q.notEq(null)),
      ),
    )
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const order of pending) {
    const sid = (order as any).serverId as string;
    try {
      switch (order.status) {
        case 'held':
          await ordersApi.hold(sid);
          break;
        case 'open':
          await ordersApi.unhold(sid);
          break;
        case 'cancelled':
          await ordersApi.cancel(sid);
          break;
        case 'confirmed':
          await ordersApi.checkout(sid, {
            payment_mode: order.paymentMode ?? 'cash',
            amount_tendered: order.amountTendered ?? undefined,
            discount_amount: order.discountAmount ?? undefined,
          } as any);
          break;
        default:
          break;
      }
      await database.write(async () => {
        await order.update((rec: any) => {rec.syncState = 'synced';});
      });
      pushed++;
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.log('[sync] push order failed:', sid, err);
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Push pending KOT status advances
// ────────────────────────────────────────────────────────────────────────────
async function pushPendingKots(): Promise<{pushed: number; failed: number}> {
  const pending = await kotsCollection
    .query(
      Q.and(
        Q.where('sync_state', 'pending'),
        Q.where('server_id', Q.notEq(null)),
      ),
    )
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const kot of pending) {
    try {
      await kotsApi.updateStatus((kot as any).serverId, (kot as any).status);
      await database.write(async () => {
        await kot.update((rec: any) => {rec.syncState = 'synced';});
      });
      pushed++;
    } catch {
      failed++;
    }
  }
  return {pushed, failed};
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ────────────────────────────────────────────────────────────────────────────
export async function runAllSyncs(): Promise<void> {
  // Skip sync when the app is backgrounded
  if (!appIsActive) return;

  const {setStatus, setLastSyncAt, setLastPulled, setLastPushed, pushError, clearErrors} =
    useSyncStore.getState();
  const {token, serverUrl} = useAuthStore.getState();

  if (!token || !serverUrl) return;

  setStatus('syncing');
  clearErrors();

  try {
    // ── Push in dependency order ─────────────────────────────────────────────
    // Items first so variants can reference real item server IDs
    const {pushed: pushedItems} = await pushPendingItems();
    const {pushed: pushedVariants} = await pushPendingItemVariants();
    // Floor plans before tables (FK dependency)
    const {pushed: pushedFloors} = await pushPendingFloorPlans();
    const {pushed: pushedTables} = await pushPendingDiningTables();
    // Orders and KOTs are independent of each other
    const [{pushed: pushedOrders}, {pushed: pushedKots}] = await Promise.all([
      pushPendingOrders(),
      pushPendingKots(),
    ]);

    const pushed =
      pushedItems + pushedVariants + pushedFloors + pushedTables + pushedOrders + pushedKots;

    // ── Pull in dependency order ─────────────────────────────────────────────
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
