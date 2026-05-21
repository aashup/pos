import React, {useEffect, useRef, useMemo, useState} from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {ordersCollection} from '@/src/db';
import Order from '@/src/db/models/Order';
import Header from '@/src/components/Header';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';
import {useThemeStore} from '@/src/store/themeStore';
import type {RootStackParamList} from '@/src/navigation/types';

type Tab = 'active' | 'held' | 'all';
type Props = {orders: Order[]};

type StatusTokens = {bg: string; accent: string; textColor: string};

function statusTokens(status: string, isDark: boolean): StatusTokens {
  if (isDark) {
    switch (status) {
      case 'open':      return {bg: '#0c2a3a', accent: '#0ea5e9', textColor: '#bae6fd'};
      case 'held':      return {bg: '#2d1f07', accent: '#f59e0b', textColor: '#fde68a'};
      case 'confirmed': return {bg: '#052e16', accent: '#16a34a', textColor: '#bbf7d0'};
      case 'cancelled': return {bg: '#1e293b', accent: '#64748b', textColor: '#94a3b8'};
      default:          return {bg: '#1e293b', accent: '#475569', textColor: '#94a3b8'};
    }
  }
  switch (status) {
    case 'open':      return {bg: '#e0f2fe', accent: '#0284c7', textColor: '#0f172a'};
    case 'held':      return {bg: '#fef3c7', accent: '#b45309', textColor: '#0f172a'};
    case 'confirmed': return {bg: '#dcfce7', accent: '#15803d', textColor: '#0f172a'};
    case 'cancelled': return {bg: '#f1f5f9', accent: '#64748b', textColor: '#0f172a'};
    default:          return {bg: '#f1f5f9', accent: '#475569', textColor: '#0f172a'};
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

type CardProps = {order: Order; onPress: (o: Order) => void; index: number};

function OrderCard({order, onPress, index}: CardProps) {
  const isDark = useThemeStore(s => s.isDark);
  const s = statusTokens(order.status, isDark);

  const translateY = useRef(new Animated.Value(20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const liftY      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 40,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn() {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1.04, tension: 220, friction: 7, useNativeDriver: true}),
      Animated.spring(liftY,  {toValue: -4,  tension: 220, friction: 7, useNativeDriver: true}),
    ]).start();
  }

  function handlePressOut() {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, tension: 220, friction: 7, useNativeDriver: true}),
      Animated.spring(liftY,  {toValue: 0, tension: 220, friction: 7, useNativeDriver: true}),
    ]).start();
  }

  const title = order.tableName ?? order.orderType.replace('_', ' ');
  const subtitle = order.tableName ? order.orderType.replace('_', ' ') : null;

  return (
    <TouchableWithoutFeedback
      onPress={() => onPress(order)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.card,
          {backgroundColor: s.bg},
          {opacity, transform: [{translateY: Animated.add(translateY, liftY)}, {scale}]},
        ]}>
        <View style={[styles.accentBar, {backgroundColor: s.accent}]} />
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, {color: s.textColor}]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.cardSubtitle, {color: s.accent}]}>
              {subtitle}
            </Text>
          )}
          <Text style={[styles.cardAmount, {color: s.textColor}]}>
            {formatCurrency(order.totalAmount)}
          </Text>
          <View style={styles.cardFooter}>
            <View style={[styles.pill, {backgroundColor: s.accent + '33', borderColor: s.accent}]}>
              <Text style={[styles.pillText, {color: s.accent}]}>
                {order.status.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.cardTime, {color: s.accent}]}>
              {formatTime(order.createdAt)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

function OrdersScreenInner({orders}: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('active');

  const filtered = useMemo(() => {
    if (tab === 'active') return orders.filter(o => o.status === 'open');
    if (tab === 'held')   return orders.filter(o => o.status === 'held');
    return orders;
  }, [orders, tab]);

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <Header title="Orders" />

      <View style={[styles.tabs, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
        {(['active', 'held', 'all'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableWithoutFeedback key={t} onPress={() => setTab(t)}>
              <View style={[styles.tab, active && {borderBottomColor: theme.primary, borderBottomWidth: 3}]}>
                <Text style={[styles.tabText, {color: active ? theme.primary : theme.textSecondary}]}>
                  {t === 'active' ? 'Active' : t === 'held' ? 'Held' : 'All'}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id}
        numColumns={2}
        contentContainerStyle={[
          styles.grid,
          filtered.length === 0 && styles.emptyContainer,
        ]}
        renderItem={({item, index}) => (
          <OrderCard
            order={item}
            index={index}
            onPress={o => nav.navigate('OrderDetail', {orderId: o.id})}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            No orders in this tab.
          </Text>
        }
      />
    </View>
  );
}

export default withObservables([], () => ({
  orders: ordersCollection
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['status', 'sync_state', 'total_amount', 'order_type', 'table_name']),
}))(OrdersScreenInner);

const styles = StyleSheet.create({
  screen: {flex: 1},
  tabs: {flexDirection: 'row', borderBottomWidth: 1},
  tab: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabText: {fontSize: 13, fontWeight: '600'},

  grid: {padding: 8},
  emptyContainer: {flex: 1, justifyContent: 'center'},
  empty: {textAlign: 'center', padding: 24, fontSize: 13},

  card: {
    flex: 1,
    margin: 6,
    borderRadius: 14,
    minHeight: 120,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 5,
  },
  accentBar: {height: 4, width: '100%'},
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {fontSize: 16, fontWeight: '800', textTransform: 'capitalize'},
  cardSubtitle: {fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginTop: 1, opacity: 0.85},
  cardAmount: {fontSize: 15, fontWeight: '700', marginTop: 6},
  cardFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8},
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {fontSize: 9, fontWeight: '800', letterSpacing: 0.5},
  cardTime: {fontSize: 10, fontWeight: '600', opacity: 0.85},
});
