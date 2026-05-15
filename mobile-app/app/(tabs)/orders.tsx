import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { withObservables } from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { useOrdersSync } from '@/hooks/useOrdersSync';
import { formatCurrency } from '@/lib/utils';
import { database } from '@/db';
import type Order from '@/db/models/Order';

const STATUS_COLOR: Record<string, string> = {
  open: 'text-green-600',
  held: 'text-blue-500',
  confirmed: 'text-gray-400',
  cancelled: 'text-red-400',
};

function OrderItem({ order }: { order: Order }) {
  return (
    <View className="bg-white mx-4 mb-3 rounded-xl p-4 border border-gray-100">
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="font-semibold text-gray-800">{order.tableName}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString()}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-bold text-gray-800">{formatCurrency(order.totalAmount)}</Text>
          <Text className={`text-xs capitalize mt-0.5 ${STATUS_COLOR[order.status] ?? 'text-gray-400'}`}>
            {order.status}
          </Text>
        </View>
      </View>
      {order.syncStatus === 'pending' && (
        <Text className="text-xs text-amber-500 mt-2">⏳ Pending sync</Text>
      )}
    </View>
  );
}

function OrdersScreen({ orders }: { orders: Order[] }) {
  const { refetch, isFetching } = useOrdersSync();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4">
        <Text className="text-xl font-bold text-gray-800">Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#d97706" />
        }
        renderItem={({ item }) => <OrderItem order={item} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400">No orders yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const enhance = withObservables([], () => ({
  orders: database
    .get<Order>('orders')
    .query(Q.sortBy('created_at', Q.desc)),
}));

export default (enhance(OrdersScreen as any) as any);
