import React, {useState, useEffect} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTheme} from '@/src/store/themeStore';
import {computeItemWise} from '@/src/lib/reportQueries';
import {formatCurrency} from '@/src/lib/utils';
import type {ItemWiseLine} from '@/src/lib/reportQueries';

type Preset = 'today' | '7d' | '30d';

function presetRange(p: Preset) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  if (p === 'today') {
    return {from: todayStart.getTime(), to: todayEnd.getTime()};
  }
  if (p === '7d') {
    const s = new Date(todayStart);
    s.setDate(s.getDate() - 6);
    return {from: s.getTime(), to: todayEnd.getTime()};
  }
  const s = new Date(todayStart);
  s.setDate(s.getDate() - 29);
  return {from: s.getTime(), to: todayEnd.getTime()};
}

const PRESETS: Preset[] = ['today', '7d', '30d'];
const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
};

export default function ItemWiseScreen() {
  const theme = useTheme();
  const [preset, setPreset] = useState<Preset>('today');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ItemWiseLine[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (p: Preset) => {
    setLoading(true);
    try {
      const {from, to} = presetRange(p);
      const result = await computeItemWise(from, to);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(preset);
  }, []);

  const filtered = data.filter(r =>
    r.itemName.toLowerCase().includes(search.toLowerCase()),
  );
  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);
  const totalRev = filtered.reduce((s, r) => s + r.revenue, 0);

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Filters */}
      <View
        style={[
          styles.filterBar,
          {backgroundColor: theme.surface, borderColor: theme.border},
        ]}>
        <View style={styles.chipRow}>
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
                {PRESET_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surfaceAlt,
              color: theme.textPrimary,
            },
          ]}
          placeholder="Search items…"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : (
        <>
          {/* Table header */}
          <View
            style={[
              styles.tableHeader,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <Text style={[styles.colItem, {color: theme.textSecondary}]}>
              ITEM
            </Text>
            <Text style={[styles.colQty, {color: theme.textSecondary}]}>
              QTY
            </Text>
            <Text style={[styles.colRev, {color: theme.textSecondary}]}>
              REVENUE
            </Text>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={r => r.itemName}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={{color: theme.textMuted}}>
                  No data for this period.
                </Text>
              </View>
            }
            renderItem={({item: row, index}) => (
              <View
                style={[
                  styles.tableRow,
                  {
                    backgroundColor:
                      index % 2 === 0 ? theme.surface : theme.surfaceAlt,
                  },
                ]}>
                <Text
                  style={[styles.colItem, {color: theme.textPrimary}]}
                  numberOfLines={1}>
                  {row.itemName}
                </Text>
                <Text style={[styles.colQty, {color: theme.textSecondary}]}>
                  {row.quantity}
                </Text>
                <Text
                  style={[
                    styles.colRev,
                    {color: theme.textPrimary, fontWeight: '500'},
                  ]}>
                  {formatCurrency(row.revenue)}
                </Text>
              </View>
            )}
          />

          {/* Totals footer */}
          <View
            style={[
              styles.footer,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <Text style={[styles.colItem, {color: theme.textPrimary, fontWeight: '700'}]}>
              Total
            </Text>
            <Text style={[styles.colQty, {color: theme.textPrimary, fontWeight: '700'}]}>
              {totalQty}
            </Text>
            <Text style={[styles.colRev, {color: theme.textPrimary, fontWeight: '700'}]}>
              {formatCurrency(totalRev)}
            </Text>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  filterBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  chipRow: {flexDirection: 'row', gap: 8},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: {backgroundColor: '#d97706'},
  chipText: {fontSize: 13, fontWeight: '500'},
  chipTextActive: {color: '#fff', fontWeight: '600'},
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 40,
  },
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  colItem: {flex: 1, fontSize: 11, fontWeight: '700'},
  colQty: {width: 44, fontSize: 11, fontWeight: '700', textAlign: 'right'},
  colRev: {width: 90, fontSize: 11, fontWeight: '700', textAlign: 'right'},
  list: {paddingBottom: 80},
  emptyWrap: {alignItems: 'center', paddingTop: 48},
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
