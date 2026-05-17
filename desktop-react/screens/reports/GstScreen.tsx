import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { computeGstSummary } from '@/src/lib/reportQueries';
import { runAllSyncs } from '@/src/lib/syncEngine';
import { SyncStatusBar } from '@/src/components/ui/SyncStatusBar';
import { formatCurrency } from '@/src/lib/utils';
import type { GstSummary } from '@/src/lib/reportQueries';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Preset = 'today' | '7d' | '30d';

function presetRange(p: Preset) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  if (p === 'today') return { from: todayStart.getTime(), to: todayEnd.getTime(), label: 'Today' };
  if (p === '7d') {
    const s = new Date(todayStart); s.setDate(s.getDate() - 6);
    return { from: s.getTime(), to: todayEnd.getTime(), label: '7 Days' };
  }
  const s = new Date(todayStart); s.setDate(s.getDate() - 29);
  return { from: s.getTime(), to: todayEnd.getTime(), label: '30 Days' };
}

const PRESETS: Preset[] = ['today', '7d', '30d'];

export default function GstScreen() {
  const navigation = useNavigation<Nav>();
  const [preset, setPreset] = useState<Preset>('today');
  const [data, setData] = useState<GstSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    await runAllSyncs();
    const { from, to } = presetRange(p);
    const result = await computeGstSummary(from, to);
    setData(result);
    setLoading(false);
  };

  useEffect(() => { load(preset); }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">GST Report</Text>
      </View>
      <SyncStatusBar />

      {/* Presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-white border-b border-gray-100 max-h-12"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      >
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => { setPreset(p); load(p); }}
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
          {/* Summary cards */}
          <View className="flex-row flex-wrap gap-3 mb-4">
            {[
              { label: 'Taxable', value: formatCurrency(data.totalTaxable) },
              { label: 'CGST', value: formatCurrency(data.totalCgst) },
              { label: 'SGST', value: formatCurrency(data.totalSgst) },
              { label: 'Total Tax', value: formatCurrency(data.totalTax) },
            ].map((kpi) => (
              <View key={kpi.label} className="flex-1 min-w-[40%] bg-white rounded-xl p-3 border border-gray-100">
                <Text className="text-gray-400 text-xs mb-1">{kpi.label}</Text>
                <Text className="text-gray-800 font-bold">{kpi.value}</Text>
              </View>
            ))}
          </View>

          {/* Rate-slab table */}
          {data.byRate.length > 0 && (
            <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">By GST Rate</Text>
              <View className="flex-row bg-gray-50 px-4 py-2 border-b border-gray-100">
                <Text className="w-12 text-xs text-gray-400 font-semibold">Rate</Text>
                <Text className="flex-1 text-xs text-gray-400 font-semibold text-right">Taxable</Text>
                <Text className="flex-1 text-xs text-gray-400 font-semibold text-right">CGST</Text>
                <Text className="flex-1 text-xs text-gray-400 font-semibold text-right">SGST</Text>
                <Text className="flex-1 text-xs text-gray-400 font-semibold text-right">Total</Text>
              </View>
              {data.byRate.map((r, i) => (
                <View key={r.rate} className={`flex-row px-4 py-3 ${i < data.byRate.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <Text className="w-12 text-gray-700 text-sm">{r.rate}%</Text>
                  <Text className="flex-1 text-gray-600 text-xs text-right">{formatCurrency(r.taxable)}</Text>
                  <Text className="flex-1 text-gray-600 text-xs text-right">{formatCurrency(r.cgst)}</Text>
                  <Text className="flex-1 text-gray-600 text-xs text-right">{formatCurrency(r.sgst)}</Text>
                  <Text className="flex-1 text-gray-800 text-xs font-medium text-right">{formatCurrency(r.total)}</Text>
                </View>
              ))}
            </View>
          )}

          {data.byRate.length === 0 && (
            <Text className="text-center text-gray-400 mt-8">No GST data for this period.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
