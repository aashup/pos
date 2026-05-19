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
import {computeGstSummary} from '@/src/lib/reportQueries';
import {formatCurrency} from '@/src/lib/utils';
import type {GstSummary} from '@/src/lib/reportQueries';

type Preset = 'today' | '7d' | '30d';

function presetRange(p: Preset): {from: number; to: number; label: string} {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (p === 'today') {
    return {from: todayStart.getTime(), to: todayEnd.getTime(), label: 'Today'};
  }
  if (p === '7d') {
    const s = new Date(todayStart);
    s.setDate(s.getDate() - 6);
    return {from: s.getTime(), to: todayEnd.getTime(), label: '7 Days'};
  }
  const s = new Date(todayStart);
  s.setDate(s.getDate() - 29);
  return {from: s.getTime(), to: todayEnd.getTime(), label: '30 Days'};
}

const PRESETS: Preset[] = ['today', '7d', '30d'];

export default function GstScreen() {
  const theme = useTheme();
  const [preset, setPreset] = useState<Preset>('today');
  const [data, setData] = useState<GstSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    try {
      const {from, to} = presetRange(p);
      const result = await computeGstSummary(from, to);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(preset);
  }, []);

  const KPIS = data
    ? [
        {label: 'Taxable', value: formatCurrency(data.totalTaxable)},
        {label: 'CGST', value: formatCurrency(data.totalCgst)},
        {label: 'SGST', value: formatCurrency(data.totalSgst)},
        {label: 'Total Tax', value: formatCurrency(data.totalTax)},
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
            onPress={() => {
              setPreset(p);
              load(p);
            }}>
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

          {/* Rate-slab table */}
          {data.byRate.length > 0 ? (
            <View
              style={[
                styles.section,
                {backgroundColor: theme.surface, borderColor: theme.border},
              ]}>
              <Text
                style={[styles.sectionTitle, {color: theme.textSecondary}]}>
                By GST Rate
              </Text>
              {/* Column header */}
              <View
                style={[
                  styles.colHeader,
                  {backgroundColor: theme.surfaceAlt, borderColor: theme.borderLight, borderBottomWidth: 1},
                ]}>
                <Text style={[styles.colRate, {color: theme.textSecondary}]}>
                  Rate
                </Text>
                <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                  Taxable
                </Text>
                <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                  CGST
                </Text>
                <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                  SGST
                </Text>
                <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                  Total
                </Text>
              </View>
              {data.byRate.map((r, i) => (
                <View
                  key={r.rate}
                  style={[
                    styles.rateRow,
                    i < data.byRate.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}>
                  <Text style={[styles.colRate, {color: theme.textPrimary}]}>
                    {r.rate}%
                  </Text>
                  <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                    {formatCurrency(r.taxable)}
                  </Text>
                  <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                    {formatCurrency(r.cgst)}
                  </Text>
                  <Text style={[styles.colNum, {color: theme.textSecondary}]}>
                    {formatCurrency(r.sgst)}
                  </Text>
                  <Text
                    style={[
                      styles.colNum,
                      {color: theme.textPrimary, fontWeight: '600'},
                    ]}>
                    {formatCurrency(r.total)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, {color: theme.textMuted}]}>
              No GST data for this period.
            </Text>
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
  kpiGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  kpiCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  kpiLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  kpiValue: {fontSize: 15, fontWeight: '700'},
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
  colHeader: {flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8},
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  colRate: {width: 40, fontSize: 12, fontWeight: '600'},
  colNum: {flex: 1, fontSize: 11, textAlign: 'right'},
  emptyText: {textAlign: 'center', marginTop: 48, fontSize: 14},
});
