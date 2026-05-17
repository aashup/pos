import { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { withObservables } from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/db';
import { KotCard } from '@/src/components/kitchen/KotCard';
import { SyncStatusBar } from '@/src/components/ui/SyncStatusBar';
import { runAllSyncs } from '@/src/lib/syncEngine';
import type Kot from '@/src/db/models/Kot';
import type Order from '@/src/db/models/Order';
import type OrderLine from '@/src/db/models/OrderLine';

type KitchenColumn = {
  key: 'new' | 'in_progress' | 'ready';
  label: string;
  color: string;
};

const COLUMNS: KitchenColumn[] = [
  { key: 'new', label: 'New', color: 'text-amber-400' },
  { key: 'in_progress', label: 'Cooking', color: 'text-blue-400' },
  { key: 'ready', label: 'Ready', color: 'text-green-400' },
];

function KitchenScreen({ kots }: { kots: Kot[] }) {
  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(() => {
      runAllSyncs().catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View className="flex-1 bg-gray-900">
      <View className="pt-4 pb-3 px-4 border-b border-gray-700">
        <Text className="text-white text-xl font-bold">Kitchen Display</Text>
      </View>
      <SyncStatusBar />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
        <View className="flex-row px-2 py-3">
          {COLUMNS.map((col) => {
            const colKots = kots.filter((k) => k.status === col.key);
            return (
              <View key={col.key} className="mr-2" style={{ width: 260 }}>
                <View className="flex-row items-center mb-3 px-2">
                  <Text className={`font-bold text-base ${col.color}`}>{col.label}</Text>
                  <View className="ml-2 bg-gray-700 rounded-full w-6 h-6 items-center justify-center">
                    <Text className="text-gray-300 text-xs">{colKots.length}</Text>
                  </View>
                </View>
                <KotColumn kots={colKots} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function KotColumnBase({ kots, orderLines, orders }: {
  kots: Kot[];
  orderLines: OrderLine[];
  orders: Order[];
}) {
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {kots.length === 0 && (
        <View className="items-center py-8">
          <Text className="text-gray-600 text-sm">No orders</Text>
        </View>
      )}
      {kots.map((kot) => {
        const kotLines = orderLines.filter((l) => l.kotId === kot.id);
        const order = orderMap.get(kot.orderId);
        const orderName = order?.tableName ?? 'Table';
        return <KotCard key={kot.id} kot={kot} lines={kotLines} orderName={orderName} />;
      })}
    </ScrollView>
  );
}

const enhanceColumn = withObservables(['kots'], ({ kots }: { kots: Kot[] }) => {
  const kotIds = kots.map((k) => k.id);
  const orderIds = kots.map((k) => k.orderId);
  return {
    orderLines: kotIds.length
      ? database.get<OrderLine>('order_lines').query(Q.where('kot_id', Q.oneOf(kotIds)))
      : database.get<OrderLine>('order_lines').query(Q.where('id', '__never__')),
    orders: orderIds.length
      ? database.get<Order>('orders').query(Q.where('id', Q.oneOf(orderIds)))
      : database.get<Order>('orders').query(Q.where('id', '__never__')),
  };
});

const KotColumn = enhanceColumn(KotColumnBase as any) as any;

// Observe all non-served kots
const enhance = withObservables([], () => ({
  kots: database
    .get<Kot>('kots')
    .query(Q.where('status', Q.notEq('served')), Q.sortBy('created_at', Q.asc)),
}));

export default (enhance(KitchenScreen as any) as any);
