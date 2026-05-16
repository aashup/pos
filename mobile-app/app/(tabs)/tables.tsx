import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useTablesSync } from '@/hooks/useTablesSync';
import { useItemsSync } from '@/hooks/useItemsSync';
import { TableCard } from '@/components/pos/TableCard';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { useCartStore } from '@/store/cartStore';
import { resumeOrderIntoCart } from '@/lib/orderActions';
import type FloorPlan from '@/db/models/FloorPlan';
import type DiningTable from '@/db/models/DiningTable';
import { database } from '@/db';

function TablesScreen({ floorPlans }: { floorPlans: FloorPlan[] }) {
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const { refetch: refetchTables, isFetching: syncingTables } = useTablesSync();
  const { isFetching: syncingItems } = useItemsSync();
  const setTable = useCartStore((s) => s.setTable);
  const db = useDatabase();

  const activeFloor = floorPlans.find((f) => f.id === activeFloorId) ?? floorPlans[0];

  const handleTablePress = useCallback(
    async (table: DiningTable) => {
      if (table.status === 'occupied' && table.currentOrderId) {
        // Resume existing order into cart
        await resumeOrderIntoCart(table.currentOrderId);
        router.push('/(tabs)/billing');
      } else {
        setTable({ id: table.id, serverId: table.serverId, name: table.name });
        router.push('/(tabs)/billing');
      }
    },
    [setTable],
  );

  const handleQrScan = useCallback(
    async (value: string) => {
      setScanning(false);
      const results = await db
        .get<DiningTable>('dining_tables')
        .query(Q.where('server_id', value))
        .fetch();
      if (results.length) {
        handleTablePress(results[0]);
      }
    },
    [db, handleTablePress],
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
      {scanning && (
        <BarcodeScanner
          onScan={handleQrScan}
          onClose={() => setScanning(false)}
          codeTypes={['qr']}
        />
      )}

      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-800">Tables</Text>
        <View className="flex-row items-center gap-3">
          {(syncingTables || syncingItems) && <ActivityIndicator size="small" color="#d97706" />}
          <TouchableOpacity
            className="bg-amber-500 px-3 py-1.5 rounded-lg"
            onPress={() => setScanning(true)}
          >
            <Text className="text-white text-sm font-medium">Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floor plan tabs */}
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

      {/* Table grid */}
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
  tables,
  onTablePress,
  onRefresh,
  refreshing,
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
