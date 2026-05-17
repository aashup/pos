import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { withObservables } from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useTablesSync } from '@/src/hooks/useTablesSync';
import { useItemsSync } from '@/src/hooks/useItemsSync';
import { TableCard } from '@/src/components/pos/TableCard';
import { useCartStore } from '@/src/store/cartStore';
import { resumeOrderIntoCart } from '@/src/lib/orderActions';
import { database } from '@/src/db';
import type FloorPlan from '@/src/db/models/FloorPlan';
import type DiningTable from '@/src/db/models/DiningTable';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function TablesScreen({ floorPlans }: { floorPlans: FloorPlan[] }) {
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const { refetch: refetchTables, isFetching: syncingTables } = useTablesSync();
  const { isFetching: syncingItems } = useItemsSync();
  const navigation = useNavigation<Nav>();
  const setTable = useCartStore((s) => s.setTable);
  const db = useDatabase();

  const activeFloor = floorPlans.find((f) => f.id === activeFloorId) ?? floorPlans[0];

  const handleTablePress = useCallback(
    async (table: DiningTable) => {
      if (table.status === 'occupied' && table.currentOrderId) {
        await resumeOrderIntoCart(table.currentOrderId);
      } else {
        setTable({ id: table.id, serverId: table.serverId, name: table.name });
      }
      navigation.navigate('Tabs', { screen: 'Billing' });
    },
    [setTable, navigation],
  );

  if (floorPlans.length === 0) {
    if (syncingTables) {
      return (
        <View className="flex-1 items-center justify-center bg-gray-50">
          <ActivityIndicator size="large" color="#d97706" />
          <Text className="text-gray-400 mt-3">Loading floor plans…</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500 text-base">No floor plans found.</Text>
        <TouchableOpacity onPress={() => refetchTables()} className="mt-4">
          <Text className="text-amber-600 font-semibold">Tap to sync</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-800">Tables</Text>
        {(syncingTables || syncingItems) && <ActivityIndicator size="small" color="#d97706" />}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white border-b border-gray-100 max-h-12"
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {floorPlans.map((plan) => {
          const isActive = (activeFloor?.id ?? floorPlans[0]?.id) === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setActiveFloorId(plan.id)}
              className={`px-4 py-3 mr-2 border-b-2 ${isActive ? 'border-amber-500' : 'border-transparent'}`}
            >
              <Text className={isActive ? 'text-amber-600 font-semibold' : 'text-gray-500'}>
                {plan.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TablesForFloor
        floorPlanId={activeFloor?.id ?? ''}
        onTablePress={handleTablePress}
        onRefresh={refetchTables}
        refreshing={syncingTables}
      />
    </View>
  );
}

function TablesForFloorBase({
  tables, onTablePress, onRefresh, refreshing,
}: {
  tables: DiningTable[];
  onTablePress: (t: DiningTable) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <FlatList
      data={tables}
      keyExtractor={(t) => t.id}
      numColumns={3}
      contentContainerStyle={{ padding: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
      renderItem={({ item }) => (
        <TableCard table={item} onPress={() => onTablePress(item)} />
      )}
      ListEmptyComponent={
        <View className="items-center py-16">
          <Text className="text-gray-400">No tables on this floor.</Text>
        </View>
      }
    />
  );
}

const enhance = withObservables(['floorPlanId'], ({ floorPlanId }: { floorPlanId: string }) => ({
  tables: database.get<DiningTable>('dining_tables').query(Q.where('floor_plan_id', floorPlanId)),
}));
const TablesForFloor = enhance(TablesForFloorBase as any) as any;

const enhanceOuter = withObservables([], () => ({
  floorPlans: database.get<FloorPlan>('floor_plans').query(),
}));
export default (enhanceOuter(TablesScreen as any) as any);
