import React, {useMemo, useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ordersCollection} from '@/src/db';
import Order from '@/src/db/models/Order';
import Header from '@/src/components/Header';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';
import type {RootStackParamList} from '@/src/navigation/types';

type Tab = 'active' | 'held' | 'all';

type Props = {orders: Order[]};

function statusColor(s: string) {
  switch (s) {
    case 'open':      return '#0ea5e9';
    case 'held':      return '#f59e0b';
    case 'confirmed': return '#16a34a';
    case 'cancelled': return '#94a3b8';
    default:          return '#475569';
  }
}

function OrdersScreenInner({orders}: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('active');

  const filtered = useMemo(() => {
    if (tab === 'active') return orders.filter(o => o.status === 'open');
    if (tab === 'held') return orders.filter(o => o.status === 'held');
    return orders;
  }, [orders, tab]);

  function handlePress(o: Order) {
    nav.navigate('OrderDetail', {orderId: o.id});
  }

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <Header title="Orders" />

      <View
        style={[
          styles.tabs,
          {backgroundColor: theme.surface, borderBottomColor: theme.border},
        ]}>
        {(['active', 'held', 'all'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tab, active && {borderBottomColor: theme.primary, borderBottomWidth: 3}]}
              onPress={() => setTab(t)}>
              <Text
                style={[
                  styles.tabText,
                  {color: active ? theme.primary : theme.textSecondary},
                ]}>
                {t === 'active' ? 'Active' : t === 'held' ? 'Held' : 'All'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id}
        renderItem={({item}) => (
          <TouchableOpacity
            style={[
              styles.row,
              {backgroundColor: theme.surface, borderBottomColor: theme.borderLight},
            ]}
            onPress={() => handlePress(item)}>
            <View style={{flex: 1}}>
              <Text style={[styles.rowTitle, {color: theme.textPrimary}]}>
                {item.tableName ?? item.orderType.replace('_', ' ')}
              </Text>
              <Text style={[styles.rowMeta, {color: theme.textSecondary}]}>
                {formatCurrency((item as any).totalAmount)} ·{' '}
                {item.orderType.replace('_', ' ')}
              </Text>
            </View>
            <View style={[styles.pill, {borderColor: statusColor(item.status)}]}>
              <Text style={[styles.pillText, {color: statusColor(item.status)}]}>
                {item.status}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            No orders in this tab.
          </Text>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

export default withObservables([], () => ({
  orders: ordersCollection
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns([
      'status',
      'sync_state',
      'total_amount',
      'order_type',
      'table_name',
    ]),
}))(OrdersScreenInner);

const styles = StyleSheet.create({
  screen: {flex: 1},
  tabs: {flexDirection: 'row', borderBottomWidth: 1},
  tab: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabText: {fontSize: 13, fontWeight: '600'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  rowTitle: {fontSize: 15, fontWeight: '700', textTransform: 'capitalize'},
  rowMeta: {fontSize: 12, marginTop: 2, textTransform: 'capitalize'},
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase'},
  empty: {textAlign: 'center', padding: 24, fontSize: 13},
  emptyContainer: {flex: 1, justifyContent: 'center'},
});
