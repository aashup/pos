import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { computeItemWise } from '@/src/lib/reportQueries';
import { runAllSyncs } from '@/src/lib/syncEngine';
import { SyncStatusBar } from '@/src/components/ui/SyncStatusBar';
import { formatCurrency } from '@/src/lib/utils';
import type { ItemWiseLine } from '@/src/lib/reportQueries';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Preset = 'today' | '7d' | '30d';

function presetRange(p: Preset) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  if (p === 'today') return { from: todayStart.getTime(), to: todayEnd.getTime() };
  if (p === '7d') {
    const s = new Date(todayStart); s.setDate(s.getDate() - 6);
    return { from: s.getTime(), to: todayEnd.getTime() };
  }
  const s = new Date(todayStart); s.setDate(s.getDate() - 29);
  return { from: s.getTime(), to: todayEnd.getTime() };
}

const PRESETS: Preset[] = ['today', '7d', '30d'];
const PRESET_LABELS: Record<Preset, string> = { today: 'Today', '7d': '7 Days', '30d': '30 Days' };

export default function ItemWiseScreen() {
  const navigation = useNavigation<Nav>();
  const [preset, setPreset] = useState<Preset>('today');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ItemWiseLine[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    await runAllSyncs();
    const { from, to } = presetRange(p);
    const result = await computeItemWise(from, to);
    setData(result);
    setLoading(false);
  };

  useEffect(() => { load(preset); }, []);

  const filtered = data.filter((r) => r.itemName.toLowerCase().includes(search.toLowerCase()));
  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);
  const totalRev = filtered.reduce((s, r) => s + r.revenue, 0);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Item Wise Report</Text>
      </View>
      <SyncStatusBar />

      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex-row gap-2 mb-3">
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => { setPreset(p); load(p); }}
              className={`px-3 py-1.5 rounded-full ${preset === p ? 'bg-amber-500' : 'bg-gray-100'}`}
            >
              <Text className={`text-sm ${preset === p ? 'text-white font-semibold' : 'text-gray-600'}`}>
                {PRESET_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700"
          placeholder="Search items…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
            <View className="bg-white border-b border-gray-200 flex-row px-4 py-2">
              <Text className="flex-1 text-xs text-gray-400 font-semibold uppercase">Item</Text>
              <Text className="w-12 text-xs text-gray-400 font-semibold uppercase text-right">Qty</Text>
              <Text className="w-24 text-xs text-gray-400 font-semibold uppercase text-right">Revenue</Text>
            </View>
            {filtered.map((row, i) => (
              <View key={row.itemName} className={`flex-row px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <Text className="flex-1 text-gray-700 text-sm" numberOfLines={1}>{row.itemName}</Text>
                <Text className="w-12 text-gray-600 text-sm text-right">{row.quantity}</Text>
                <Text className="w-24 text-gray-800 text-sm font-medium text-right">{formatCurrency(row.revenue)}</Text>
              </View>
            ))}
            {filtered.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-gray-400">No data for this period.</Text>
              </View>
            )}
          </ScrollView>
          {/* Totals footer */}
          <View className="bg-white border-t border-gray-200 flex-row px-4 py-3">
            <Text className="flex-1 text-gray-700 font-bold">Total</Text>
            <Text className="w-12 text-gray-700 font-bold text-right">{totalQty}</Text>
            <Text className="w-24 text-gray-800 font-bold text-right">{formatCurrency(totalRev)}</Text>
          </View>
        </>
      )}
    </View>
  );
}
