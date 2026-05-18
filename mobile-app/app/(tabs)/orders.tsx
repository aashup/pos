import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { useOrdersSync } from '@/hooks/useOrdersSync';
import { SyncStatusBar } from '@/components/ui/SyncStatusBar';
import { formatCurrency } from '@/lib/utils';
import { database } from '@/db';
import type Order from '@/db/models/Order';

type Tab = 'active' | 'held' | 'all';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'held', label: 'Held' },
  { key: 'all', label: 'All' },
];

const STATUS_COLOR: Record<string, string> = {
  open: 'text-green-600',
  held: 'text-blue-500',
  confirmed: 'text-gray-400',
  cancelled: 'text-red-400',
};

function OrderItem({ order }: { order: Order }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/order/${order.id}`)}
      className="bg-white mx-4 mb-3 rounded-xl p-4 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="font-semibold text-gray-800">{order.tableName}</Text>
          <Text className="text-xs text-gray-400 mt-0.5 capitalize">{order.orderType?.replace('_', ' ') ?? 'dine in'}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString()}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-bold text-gray-800">{formatCurrency(order.totalAmount)}</Text>
          <Text className={`text-xs capitalize mt-0.5 ${STATUS_COLOR[order.status] ?? 'text-gray-400'}`}>
            {order.status}
          </Text>
          {order.syncStatus === 'pending' && (
            <Text className="text-xs text-amber-500 mt-1">⏳ Pending sync</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function OrdersScreen({ activeOrders, heldOrders, allOrders }: {
  activeOrders: Order[];
  heldOrders: Order[];
  allOrders: Order[];
}) {
  const [tab, setTab] = useState<Tab>('active');
  const { refetch, isFetching } = useOrdersSync();

  const data = tab === 'active' ? activeOrders : tab === 'held' ? heldOrders : allOrders;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-0 px-4">
        <Text className="text-xl font-bold text-gray-800 pb-3">Orders</Text>
        <View className="flex-row">
          {TAB_LABELS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`mr-4 pb-2 border-b-2 ${tab === t.key ? 'border-amber-500' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-medium ${tab === t.key ? 'text-amber-600' : 'text-gray-500'}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <SyncStatusBar />
      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#d97706" />
        }
        renderItem={({ item }) => <OrderItem order={item} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400">No orders.</Text>
          </View>
        }
      />
    </View>
  );
}

const enhance = withObservables([], () => ({
  activeOrders: database.get<Order>('orders').query(Q.where('status', 'open'), Q.sortBy('created_at', Q.desc)),
  heldOrders: database.get<Order>('orders').query(Q.where('status', 'held'), Q.sortBy('created_at', Q.desc)),
  allOrders: database.get<Order>('orders').query(Q.sortBy('created_at', Q.desc)),
}));

export default (enhance(OrdersScreen as any) as any);
