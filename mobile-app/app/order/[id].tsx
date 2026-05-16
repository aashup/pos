import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import { cancelOrder, unholdOrder } from '@/lib/orderActions';
import { formatCurrency } from '@/lib/utils';
import type Order from '@/db/models/Order';
import type OrderLine from '@/db/models/OrderLine';

const KOT_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-200 text-gray-600',
  sent: 'bg-amber-100 text-amber-700',
  cooking: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  served: 'bg-gray-100 text-gray-400',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const o = await database.get<Order>('orders').find(id);
      const ls = await database.get<OrderLine>('order_lines').query(Q.where('order_id', id)).fetch();
      setOrder(o);
      setLines(ls);
      setLoading(false);
    })();
  }, [id]);

  const handleResume = async () => {
    if (!order) return;
    if (order.status === 'held') {
      await unholdOrder(order.id);
    } else {
      const { resumeOrderIntoCart } = await import('@/lib/orderActions');
      await resumeOrderIntoCart(order.id);
    }
    router.push('/(tabs)/billing');
  };

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          await cancelOrder(id!);
          router.back();
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!order) return;
    const lineText = lines.map((l) => `  ${l.itemName} x${l.quantity}  ₹${(l.price * l.quantity).toFixed(2)}`).join('\n');
    const text = [
      `Order: ${order.tableName}`,
      `Type: ${order.orderType?.replace('_', ' ') ?? 'Dine In'}`,
      `Date: ${new Date(order.createdAt).toLocaleString()}`,
      '─────────────────',
      lineText,
      '─────────────────',
      `Total: ${formatCurrency(order.totalAmount)}`,
      order.cgstTotal ? `CGST: ${formatCurrency(order.cgstTotal)}` : '',
      order.sgstTotal ? `SGST: ${formatCurrency(order.sgstTotal)}` : '',
      order.paymentMode ? `Payment: ${order.paymentMode.toUpperCase()}` : '',
    ].filter(Boolean).join('\n');
    await Share.share({ message: text });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Order not found.</Text>
      </View>
    );
  }

  const canResume = order.status === 'open' || order.status === 'held';
  const canCancel = order.status === 'open' || order.status === 'held';

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-amber-600 font-medium">← Back</Text>
        </TouchableOpacity>
        <Text className="font-bold text-gray-800">{order.tableName}</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text className="text-amber-600 text-sm">Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Meta */}
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 border border-gray-100">
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-500 text-sm">Order Type</Text>
            <Text className="text-gray-700 text-sm capitalize">{order.orderType?.replace('_', ' ') ?? 'Dine In'}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-500 text-sm">Status</Text>
            <Text className="text-gray-700 text-sm capitalize">{order.status}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Time</Text>
            <Text className="text-gray-700 text-sm">{new Date(order.createdAt).toLocaleTimeString()}</Text>
          </View>
        </View>

        {/* Lines */}
        <View className="bg-white mx-4 mt-4 rounded-xl border border-gray-100 overflow-hidden">
          <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Items</Text>
          {lines.map((l, i) => (
            <View key={l.id} className={`px-4 py-3 flex-row justify-between ${i < lines.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <View className="flex-1 mr-2">
                <Text className="text-gray-800 text-sm">{l.itemName}</Text>
                {l.variantName && <Text className="text-gray-400 text-xs">{l.variantName}</Text>}
                {l.note && <Text className="text-amber-600 text-xs italic">{l.note}</Text>}
              </View>
              <View className="items-end">
                <Text className="text-gray-700 text-sm font-medium">{formatCurrency(l.price * l.quantity)}</Text>
                <Text className="text-gray-400 text-xs">×{l.quantity}</Text>
                <View className={`mt-1 px-2 py-0.5 rounded text-xs ${KOT_STATUS_COLOR[l.kotStatus ?? 'pending']}`}>
                  <Text className="text-xs capitalize">{l.kotStatus ?? 'pending'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 border border-gray-100">
          {order.cgstTotal != null && order.cgstTotal > 0 && (
            <>
              <View className="flex-row justify-between mb-1">
                <Text className="text-gray-500 text-sm">CGST</Text>
                <Text className="text-gray-700 text-sm">{formatCurrency(order.cgstTotal)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500 text-sm">SGST</Text>
                <Text className="text-gray-700 text-sm">{formatCurrency(order.sgstTotal ?? 0)}</Text>
              </View>
            </>
          )}
          <View className="flex-row justify-between border-t border-gray-100 pt-2">
            <Text className="font-bold text-gray-800">Total</Text>
            <Text className="font-bold text-gray-800">{formatCurrency(order.totalAmount)}</Text>
          </View>
          {order.paymentMode && (
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-500 text-sm">Payment</Text>
              <Text className="text-gray-700 text-sm uppercase">{order.paymentMode}</Text>
            </View>
          )}
          {order.changeAmount != null && order.changeAmount > 0 && (
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-500 text-sm">Change Given</Text>
              <Text className="text-green-600 text-sm">{formatCurrency(order.changeAmount)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="mx-4 mt-4 gap-3">
          {canResume && (
            <TouchableOpacity
              onPress={handleResume}
              className="bg-amber-500 py-4 rounded-xl items-center"
            >
              <Text className="text-white font-bold">{order.status === 'held' ? 'Resume (Unhold)' : 'Resume Order'}</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              onPress={handleCancel}
              className="border border-red-300 py-4 rounded-xl items-center"
            >
              <Text className="text-red-500 font-semibold">Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
