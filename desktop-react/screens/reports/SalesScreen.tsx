import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { computeSalesSummary } from '@/src/lib/reportQueries';
import { runAllSyncs } from '@/src/lib/syncEngine';
import { SyncStatusBar } from '@/src/components/ui/SyncStatusBar';
import { formatCurrency } from '@/src/lib/utils';
import type { SalesSummary } from '@/src/lib/reportQueries';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Preset = 'today' | 'yesterday' | '7d' | '30d';

function presetRange(p: Preset): { from: number; to: number; label: string } {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  if (p === 'today') return { from: todayStart.getTime(), to: todayEnd.getTime(), label: 'Today' };
  if (p === 'yesterday') {
    const y = new Date(todayStart); y.setDate(y.getDate() - 1);
    const ye = new Date(todayEnd); ye.setDate(ye.getDate() - 1);
    return { from: y.getTime(), to: ye.getTime(), label: 'Yesterday' };
  }
  if (p === '7d') {
    const s = new Date(todayStart); s.setDate(s.getDate() - 6);
    return { from: s.getTime(), to: todayEnd.getTime(), label: 'Last 7 Days' };
  }
  const s = new Date(todayStart); s.setDate(s.getDate() - 29);
  return { from: s.getTime(), to: todayEnd.getTime(), label: 'Last 30 Days' };
}

const PRESETS: Preset[] = ['today', 'yesterday', '7d', '30d'];

export default function SalesScreen() {
  const navigation = useNavigation<Nav>();
  const [preset, setPreset] = useState<Preset>('today');
  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    await runAllSyncs();
    const { from, to } = presetRange(p);
    const result = await computeSalesSummary(from, to);
    setData(result);
    setLoading(false);
  };

  useEffect(() => { load(preset); }, []);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    load(p);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Sales Summary</Text>
      </View>
      <SyncStatusBar />

      {/* Date presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white border-b border-gray-100 max-h-12"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      >
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => handlePreset(p)}
            className={`px-4 py-1.5 rounded-full mr-2 ${preset === p ? 'bg-amber-500' : 'bg-gray-100'}`}
          >
            <Text className={`text-sm font-medium ${preset === p ? 'text-white' : 'text-gray-600'}`}>
              {presetRange(p).label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* KPI cards */}
          <View className="flex-row flex-wrap gap-3 mb-4">
            {[
              { label: 'Orders', value: String(data.totalOrders) },
              { label: 'Revenue', value: formatCurrency(data.totalRevenue) },
              { label: 'Avg Order', value: formatCurrency(data.avgOrderValue) },
              { label: 'Tax', value: formatCurrency(data.totalCgst + data.totalSgst) },
            ].map((kpi) => (
              <View key={kpi.label} className="flex-1 min-w-[40%] bg-white rounded-xl p-3 border border-gray-100">
                <Text className="text-gray-400 text-xs mb-1">{kpi.label}</Text>
                <Text className="text-gray-800 font-bold text-base">{kpi.value}</Text>
              </View>
            ))}
          </View>

          {/* By order type */}
          <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
            <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">By Order Type</Text>
            {Object.entries(data.byOrderType).map(([type, v], i, arr) => (
              <View key={type} className={`flex-row justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <Text className="text-gray-700 capitalize">{type.replace('_', ' ')}</Text>
                <Text className="text-gray-500 text-sm">{v.count} orders · {formatCurrency(v.revenue)}</Text>
              </View>
            ))}
            {Object.keys(data.byOrderType).length === 0 && (
              <Text className="text-gray-400 text-sm px-4 pb-3">No data</Text>
            )}
          </View>

          {/* By payment mode */}
          <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
            <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">By Payment Mode</Text>
            {Object.entries(data.byPaymentMode).map(([mode, v], i, arr) => (
              <View key={mode} className={`flex-row justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <Text className="text-gray-700 capitalize">{mode}</Text>
                <Text className="text-gray-500 text-sm">{v.count} · {formatCurrency(v.revenue)}</Text>
              </View>
            ))}
            {Object.keys(data.byPaymentMode).length === 0 && (
              <Text className="text-gray-400 text-sm px-4 pb-3">No data</Text>
            )}
          </View>

          {/* Daily breakdown */}
          {data.daily.length > 0 && (
            <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Daily</Text>
              {data.daily.map((d, i) => (
                <View key={d.date} className={`flex-row justify-between px-4 py-3 ${i < data.daily.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <Text className="text-gray-700">{d.date}</Text>
                  <Text className="text-gray-500 text-sm">{d.orders} orders · {formatCurrency(d.revenue)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
