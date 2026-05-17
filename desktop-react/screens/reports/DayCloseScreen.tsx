import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { computeDayClose } from '@/src/lib/reportQueries';
import { runAllSyncs } from '@/src/lib/syncEngine';
import { SyncStatusBar } from '@/src/components/ui/SyncStatusBar';
import { formatCurrency } from '@/src/lib/utils';
import type { DayClose } from '@/src/lib/reportQueries';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DayCloseScreen() {
  const navigation = useNavigation<Nav>();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<DayClose | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: string) => {
    setLoading(true);
    await runAllSyncs();
    const result = await computeDayClose(d);
    setData(result);
    setLoading(false);
  };

  useEffect(() => { load(date); }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Day Close</Text>
      </View>
      <SyncStatusBar />

      {/* Date nav */}
      <View className="flex-row items-center justify-center py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1);
            const s = d.toISOString().slice(0, 10); setDate(s); load(s);
          }}
          className="px-4 py-2"
        >
          <Text className="text-amber-600 text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="font-semibold text-gray-800 text-base mx-4">{date}</Text>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1);
            const s = d.toISOString().slice(0, 10); setDate(s); load(s);
          }}
          className="px-4 py-2"
        >
          <Text className="text-amber-600 text-lg">›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Summary card */}
          <View className="bg-amber-500 rounded-2xl p-5 mb-4">
            <Text className="text-amber-100 text-sm mb-1">{data.date}</Text>
            <Text className="text-white text-3xl font-bold mb-1">{formatCurrency(data.totalRevenue)}</Text>
            <Text className="text-amber-100 text-sm">
              {data.totalOrders} orders · Tax: {formatCurrency(data.cgstTotal + data.sgstTotal)}
            </Text>
          </View>

          {/* Payment breakdown */}
          <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
            <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Payment Breakdown</Text>
            {Object.entries(data.byPaymentMode).map(([mode, amount], i, arr) => (
              <View key={mode} className={`flex-row justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <Text className="text-gray-700 capitalize">{mode}</Text>
                <Text className="text-gray-800 font-medium">{formatCurrency(amount)}</Text>
              </View>
            ))}
            {Object.keys(data.byPaymentMode).length === 0 && (
              <Text className="text-gray-400 text-sm px-4 pb-3">No payments</Text>
            )}
          </View>

          {/* Top items */}
          {data.topItems.length > 0 && (
            <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Top Items</Text>
              {data.topItems.map((item, i) => (
                <View
                  key={item.itemName}
                  className={`flex-row justify-between items-center px-4 py-3 ${i < data.topItems.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <View className="flex-row items-center">
                    <Text className="text-gray-400 text-sm w-6">{i + 1}.</Text>
                    <Text className="text-gray-700" numberOfLines={1}>{item.itemName}</Text>
                  </View>
                  <Text className="text-gray-500 text-sm ml-2">×{item.quantity} · {formatCurrency(item.revenue)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
