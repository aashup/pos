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
import {computeDayClose} from '@/src/lib/reportQueries';
import {formatCurrency} from '@/src/lib/utils';
import type {DayClose} from '@/src/lib/reportQueries';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DayCloseScreen() {
  const theme = useTheme();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<DayClose | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const result = await computeDayClose(d);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
  }, []);

  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const s = d.toISOString().slice(0, 10);
    setDate(s);
    load(s);
  }

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      {/* Date navigator */}
      <View
        style={[
          styles.dateNav,
          {backgroundColor: theme.surface, borderColor: theme.border},
        ]}>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => shiftDate(-1)}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.dateLabel, {color: theme.textPrimary}]}>
          {date}
        </Text>
        <TouchableOpacity
          style={styles.dateNavBtn}
          onPress={() => shiftDate(1)}>
          <Text style={styles.dateNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Summary hero card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroDate}>{data.date}</Text>
            <Text style={styles.heroRevenue}>
              {formatCurrency(data.totalRevenue)}
            </Text>
            <Text style={styles.heroSub}>
              {data.totalOrders} orders · Tax:{' '}
              {formatCurrency(data.cgstTotal + data.sgstTotal)}
            </Text>
          </View>

          {/* Payment breakdown */}
          <View
            style={[
              styles.section,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>
              Payment Breakdown
            </Text>
            {Object.entries(data.byPaymentMode).map(
              ([mode, amount], i, arr) => (
                <View
                  key={mode}
                  style={[
                    styles.tableRow,
                    i < arr.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}>
                  <Text
                    style={[styles.tableKey, {color: theme.textPrimary}]}>
                    {mode}
                  </Text>
                  <Text
                    style={[styles.tableVal, {color: theme.textPrimary}]}>
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ),
            )}
            {Object.keys(data.byPaymentMode).length === 0 && (
              <Text style={[styles.emptyText, {color: theme.textMuted}]}>
                No payments
              </Text>
            )}
          </View>

          {/* Top items */}
          {data.topItems.length > 0 && (
            <View
              style={[
                styles.section,
                {backgroundColor: theme.surface, borderColor: theme.border},
              ]}>
              <Text
                style={[styles.sectionTitle, {color: theme.textSecondary}]}>
                Top Items
              </Text>
              {data.topItems.map((item, i) => (
                <View
                  key={item.itemName}
                  style={[
                    styles.tableRow,
                    i < data.topItems.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}>
                  <Text
                    style={[styles.rankText, {color: theme.textMuted}]}>
                    {i + 1}.
                  </Text>
                  <Text
                    style={[
                      styles.itemName,
                      {color: theme.textPrimary},
                    ]}
                    numberOfLines={1}>
                    {item.itemName}
                  </Text>
                  <Text
                    style={[styles.itemMeta, {color: theme.textSecondary}]}>
                    ×{item.quantity} · {formatCurrency(item.revenue)}
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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  dateNavBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  dateNavArrow: {color: '#d97706', fontSize: 22},
  dateLabel: {fontSize: 15, fontWeight: '600', minWidth: 100, textAlign: 'center'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scroll: {padding: 14, paddingBottom: 32, gap: 12},
  heroCard: {
    backgroundColor: '#d97706',
    borderRadius: 16,
    padding: 20,
  },
  heroDate: {color: '#fef3c7', fontSize: 13, marginBottom: 4},
  heroRevenue: {color: '#fff', fontSize: 30, fontWeight: '700', marginBottom: 4},
  heroSub: {color: '#fef3c7', fontSize: 13},
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
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  tableKey: {flex: 1, fontSize: 14, textTransform: 'capitalize'},
  tableVal: {fontSize: 14, fontWeight: '500'},
  emptyText: {fontSize: 13, paddingHorizontal: 14, paddingBottom: 12},
  rankText: {fontSize: 12, width: 24},
  itemName: {flex: 1, fontSize: 13},
  itemMeta: {fontSize: 12, marginLeft: 8},
});
