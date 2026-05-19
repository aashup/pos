import React, {useState, useEffect} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTheme} from '@/src/store/themeStore';
import {computeSalesSummary} from '@/src/lib/reportQueries';
import {formatCurrency} from '@/src/lib/utils';
import type {SalesSummary} from '@/src/lib/reportQueries';

type Preset = 'today' | 'yesterday' | '7d' | '30d';

function presetRange(p: Preset): {from: number; to: number; label: string} {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (p === 'today') {
    return {
      from: todayStart.getTime(),
      to: todayEnd.getTime(),
      label: 'Today',
    };
  }
  if (p === 'yesterday') {
    const y = new Date(todayStart);
    y.setDate(y.getDate() - 1);
    const ye = new Date(todayEnd);
    ye.setDate(ye.getDate() - 1);
    return {from: y.getTime(), to: ye.getTime(), label: 'Yesterday'};
  }
  if (p === '7d') {
    const s = new Date(todayStart);
    s.setDate(s.getDate() - 6);
    return {from: s.getTime(), to: todayEnd.getTime(), label: 'Last 7 Days'};
  }
  const s = new Date(todayStart);
  s.setDate(s.getDate() - 29);
  return {from: s.getTime(), to: todayEnd.getTime(), label: 'Last 30 Days'};
}

const PRESETS: Preset[] = ['today', 'yesterday', '7d', '30d'];

export default function SalesScreen() {
  const theme = useTheme();
  const [preset, setPreset] = useState<Preset>('today');
  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    try {
      const {from, to} = presetRange(p);
      const result = await computeSalesSummary(from, to);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(preset);
  }, []);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    load(p);
  };

  const KPIS = data
    ? [
        {label: 'Orders', value: String(data.totalOrders)},
        {label: 'Revenue', value: formatCurrency(data.totalRevenue)},
        {label: 'Avg Order', value: formatCurrency(data.avgOrderValue)},
        {
          label: 'Tax',
          value: formatCurrency(data.totalCgst + data.totalSgst),
        },
      ]
    : [];

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      {/* Preset chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.presetsBar, {backgroundColor: theme.surface, borderColor: theme.border}]}
        contentContainerStyle={styles.presetsContent}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.chip,
              preset === p
                ? styles.chipActive
                : {backgroundColor: theme.surfaceAlt},
            ]}
            onPress={() => handlePreset(p)}>
            <Text
              style={[
                styles.chipText,
                preset === p
                  ? styles.chipTextActive
                  : {color: theme.textSecondary},
              ]}>
              {presetRange(p).label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* KPI cards */}
          <View style={styles.kpiGrid}>
            {KPIS.map(kpi => (
              <View
                key={kpi.label}
                style={[
                  styles.kpiCard,
                  {backgroundColor: theme.surface, borderColor: theme.border},
                ]}>
                <Text style={[styles.kpiLabel, {color: theme.textSecondary}]}>
                  {kpi.label}
                </Text>
                <Text style={[styles.kpiValue, {color: theme.textPrimary}]}>
                  {kpi.value}
                </Text>
              </View>
            ))}
          </View>

          {/* By order type */}
          <View
            style={[
              styles.section,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>
              By Order Type
            </Text>
            {Object.entries(data.byOrderType).map(([type, v], i, arr) => (
              <View
                key={type}
                style={[
                  styles.tableRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.borderLight,
                  },
                ]}>
                <Text style={[styles.tableKey, {color: theme.textPrimary}]}>
                  {type.replace('_', ' ')}
                </Text>
                <Text style={[styles.tableVal, {color: theme.textSecondary}]}>
                  {v.count} orders · {formatCurrency(v.revenue)}
                </Text>
              </View>
            ))}
            {Object.keys(data.byOrderType).length === 0 && (
              <Text style={[styles.empty, {color: theme.textMuted}]}>
                No data
              </Text>
            )}
          </View>

          {/* By payment mode */}
          <View
            style={[
              styles.section,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>
              By Payment Mode
            </Text>
            {Object.entries(data.byPaymentMode).map(([mode, v], i, arr) => (
              <View
                key={mode}
                style={[
                  styles.tableRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.borderLight,
                  },
                ]}>
                <Text style={[styles.tableKey, {color: theme.textPrimary}]}>
                  {mode}
                </Text>
                <Text style={[styles.tableVal, {color: theme.textSecondary}]}>
                  {v.count} · {formatCurrency(v.revenue)}
                </Text>
              </View>
            ))}
            {Object.keys(data.byPaymentMode).length === 0 && (
              <Text style={[styles.empty, {color: theme.textMuted}]}>
                No data
              </Text>
            )}
          </View>

          {/* Daily breakdown */}
          {data.daily.length > 0 && (
            <View
              style={[
                styles.section,
                {backgroundColor: theme.surface, borderColor: theme.border},
              ]}>
              <Text
                style={[styles.sectionTitle, {color: theme.textSecondary}]}>
                Daily
              </Text>
              {data.daily.map((d, i) => (
                <View
                  key={d.date}
                  style={[
                    styles.tableRow,
                    i < data.daily.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}>
                  <Text style={[styles.tableKey, {color: theme.textPrimary}]}>
                    {d.date}
                  </Text>
                  <Text
                    style={[styles.tableVal, {color: theme.textSecondary}]}>
                    {d.orders} orders · {formatCurrency(d.revenue)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  presetsBar: {flexGrow: 0, borderBottomWidth: 1},
  presetsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: {backgroundColor: '#d97706'},
  chipText: {fontSize: 13, fontWeight: '500'},
  chipTextActive: {color: '#fff', fontWeight: '600'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scroll: {padding: 14, paddingBottom: 32, gap: 12},
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  kpiLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  kpiValue: {fontSize: 16, fontWeight: '700'},
  section: {borderRadius: 12, borderWidth: 1, overflow: 'hidden'},
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
  },
  tableKey: {fontSize: 14, textTransform: 'capitalize'},
  tableVal: {fontSize: 13},
  empty: {fontSize: 13, paddingHorizontal: 14, paddingBottom: 12},
});
