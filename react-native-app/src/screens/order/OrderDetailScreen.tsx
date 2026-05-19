import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';

import {ordersCollection, orderLinesCollection} from '@/src/db';
import Order from '@/src/db/models/Order';
import OrderLine from '@/src/db/models/OrderLine';
import {resumeOrder, cancelOrder} from '@/src/lib/orderActions';
import {printReceipt} from '@/src/lib/printer';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';
import type {RootStackParamList} from '@/src/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'OrderDetail'>;

function statusColor(s: string) {
  switch (s) {
    case 'open':      return '#0ea5e9';
    case 'held':      return '#f59e0b';
    case 'confirmed': return '#16a34a';
    case 'cancelled': return '#94a3b8';
    default:          return '#475569';
  }
}

function kotBadgeColor(s: string) {
  switch (s) {
    case 'pending': return '#94a3b8';
    case 'sent':    return '#3b82f6';
    case 'cooking': return '#f59e0b';
    case 'ready':   return '#16a34a';
    case 'served':  return '#64748b';
    default:        return '#94a3b8';
  }
}

function OrderDetailInner({order, lines}: {order: Order; lines: OrderLine[]}) {
  const nav = useNavigation<Nav>();
  const theme = useTheme();
  const [printing, setPrinting] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const canResume = order.status === 'open' || order.status === 'held';
  const canCancel = order.status === 'open' || order.status === 'held';
  const sColor = statusColor(order.status);

  async function handleResume() {
    try {
      await resumeOrder(order.id);
      nav.navigate('Tabs', {screen: 'Billing'} as any);
    } catch (err: any) {
      Alert.alert('Could not resume', err?.message ?? String(err));
    }
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      await printReceipt(order.id);
    } catch (err: any) {
      Alert.alert('Print failed', err?.message ?? String(err));
    } finally {
      setPrinting(false);
    }
  }

  function handleCancel() {
    Alert.alert('Cancel order?', 'This cannot be undone.', [
      {text: 'Back', style: 'cancel'},
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(order.id);
            nav.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? String(err));
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Order header card */}
        <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <View style={styles.headerRow}>
            <Text style={[styles.orderTitle, {color: theme.textPrimary}]}>
              {order.tableName ?? order.orderType.replace('_', ' ')}
            </Text>
            <View style={[styles.statusPill, {borderColor: sColor}]}>
              <Text style={[styles.statusPillText, {color: sColor}]}>
                {order.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.orderMeta, {color: theme.textSecondary}]}>
            {order.orderType.replace('_', ' ')}
            {order.createdAt
              ? ' · ' + new Date(order.createdAt).toLocaleString()
              : ''}
          </Text>
          {order.paymentMode ? (
            <Text style={[styles.orderMeta, {color: theme.textSecondary}]}>
              Payment: {order.paymentMode.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* Items */}
        <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>
            Items ({lines.length})
          </Text>
          {lines.length === 0 ? (
            <Text style={[styles.empty, {color: theme.textMuted}]}>
              No items in this order.
            </Text>
          ) : (
            lines.map(l => (
              <View
                key={l.id}
                style={[styles.lineRow, {borderBottomColor: theme.borderLight}]}>
                <View style={{flex: 1}}>
                  <Text style={[styles.lineName, {color: theme.textPrimary}]}>
                    {l.itemName}
                    {l.variantName ? ` · ${l.variantName}` : ''}
                  </Text>
                  <Text style={[styles.lineMeta, {color: theme.textSecondary}]}>
                    {formatCurrency(l.price)} × {l.quantity}
                    {l.note ? ` · ${l.note}` : ''}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end', gap: 4}}>
                  <Text style={[styles.lineTotal, {color: theme.textPrimary}]}>
                    {formatCurrency(l.price * l.quantity)}
                  </Text>
                  <View style={[styles.kotBadge, {backgroundColor: kotBadgeColor(l.kotStatus)}]}>
                    <Text style={styles.kotBadgeText}>{l.kotStatus.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Totals */}
        <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Totals</Text>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>Subtotal</Text>
            <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
              {formatCurrency(subtotal)}
            </Text>
          </View>
          {(order.cgstTotal + order.sgstTotal) > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>
                GST (CGST {formatCurrency(order.cgstTotal)} + SGST{' '}
                {formatCurrency(order.sgstTotal)})
              </Text>
              <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
                {formatCurrency(order.cgstTotal + order.sgstTotal)}
              </Text>
            </View>
          )}
          <View
            style={[styles.totalRow, styles.grandRow, {borderTopColor: theme.border}]}>
            <Text style={[styles.grandLabel, {color: theme.textPrimary}]}>Grand Total</Text>
            <Text style={[styles.grandValue, {color: theme.textPrimary}]}>
              {formatCurrency(order.totalAmount)}
            </Text>
          </View>
          {order.amountPaid != null && order.amountPaid > 0 ? (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>Amount paid</Text>
              <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
                {formatCurrency(order.amountPaid)}
              </Text>
            </View>
          ) : null}
          {(order.changeAmount ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>Change</Text>
              <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
                {formatCurrency(order.changeAmount!)}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, {backgroundColor: theme.surface, borderTopColor: theme.border}]}>
        <TouchableOpacity
          style={[styles.printBtn, printing && styles.btnDisabled]}
          onPress={handlePrint}
          disabled={printing}>
          {printing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.printBtnText}>🖨 Receipt</Text>}
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {canResume && (
          <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
            <Text style={styles.resumeBtnText}>Resume →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const OrderDetailObserved = withObservables(
  ['orderId'],
  ({orderId}: {orderId: string}) => ({
    order: ordersCollection.findAndObserve(orderId),
    lines: orderLinesCollection.query(Q.where('order_id', orderId)).observe(),
  }),
)(OrderDetailInner);

export default function OrderDetailScreen() {
  const route = useRoute<DetailRoute>();
  return <OrderDetailObserved orderId={route.params.orderId} />;
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  scroll: {padding: 12, gap: 12},

  card: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    marginLeft: 8,
  },
  statusPillText: {fontSize: 11, fontWeight: '800'},
  orderMeta: {fontSize: 12, marginTop: 2, textTransform: 'capitalize'},

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  lineRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  lineName: {fontSize: 14, fontWeight: '600'},
  lineMeta: {fontSize: 12, marginTop: 2},
  lineTotal: {fontSize: 13, fontWeight: '700'},
  kotBadge: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
  kotBadgeText: {fontSize: 9, fontWeight: '800', color: '#fff'},

  empty: {fontSize: 13, textAlign: 'center', padding: 12},

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {fontSize: 13, flex: 1},
  totalValue: {fontSize: 13, fontWeight: '600'},
  grandRow: {borderTopWidth: 1, marginTop: 6, paddingTop: 8},
  grandLabel: {fontSize: 15, fontWeight: '800'},
  grandValue: {fontSize: 16, fontWeight: '800'},

  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  btnDisabled: {opacity: 0.5},
  printBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  printBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  cancelBtnText: {color: '#dc2626', fontWeight: '700'},
  resumeBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
  },
  resumeBtnText: {color: '#fff', fontWeight: '800', fontSize: 15},
});
