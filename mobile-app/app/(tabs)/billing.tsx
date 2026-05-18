import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCartStore } from '@/store/cartStore';
import { sendKot, checkout, holdOrder } from '@/lib/orderActions';
import type { PaymentData } from '@/lib/orderActions';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { ItemCard } from '@/components/pos/ItemCard';
import { ChefNoteInput } from '@/components/pos/ChefNoteInput';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { VariantModifierModal } from '@/components/pos/VariantModifierModal';
import { formatCurrency } from '@/lib/utils';
import { database } from '@/db';
import type Item from '@/db/models/Item';
import type ItemGroup from '@/db/models/ItemGroup';
import type { SelectedModifier } from '@/store/cartStore';

type OrderType = 'dine_in' | 'takeaway' | 'delivery';
const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: 'dine_in', label: 'Dine In' },
  { key: 'takeaway', label: 'Takeaway' },
  { key: 'delivery', label: 'Delivery' },
];

function BillingScreen({ items, itemGroups }: { items: Item[]; itemGroups: ItemGroup[] }) {
  const [search, setSearch] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [variantItem, setVariantItem] = useState<Item | null>(null);
  const db = useDatabase();

  const {
    table, lines, orderType, setOrderType, addItem, incrementQty, decrementQty, computeTotals,
  } = useCartStore();
  const { subtotal, cgstTotal, sgstTotal, netPayable, unsentCount } = computeTotals();

  const filteredItems = items.filter((item) => {
    const matchesGroup = activeGroupId === 'all' || item.itemGroupId === activeGroupId;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const handleBarcodeScan = useCallback(
    async (value: string) => {
      setScanning(false);
      const results = await db.get<Item>('items').query(Q.where('barcode', value)).fetch();
      if (results.length) {
        const item = results[0];
        if (item.hasVariants || item.hasModifiers) {
          setVariantItem(item);
        } else {
          addItem({
            itemId: item.serverId,
            itemName: item.name,
            price: item.price,
            cgstPct: item.cgstPct ?? 0,
            sgstPct: item.sgstPct ?? 0,
          });
        }
      }
    },
    [db, addItem],
  );

  const handleItemPress = (item: Item) => {
    if (item.hasVariants || item.hasModifiers) {
      setVariantItem(item);
    } else {
      addItem({
        itemId: item.serverId,
        itemName: item.name,
        price: item.price,
        cgstPct: item.cgstPct ?? 0,
        sgstPct: item.sgstPct ?? 0,
      });
    }
  };

  const handleVariantAdd = (opts: {
    price: number;
    variantId: string | null;
    variantName: string | null;
    selectedModifiers: SelectedModifier[];
  }) => {
    if (!variantItem) return;
    addItem({
      itemId: variantItem.serverId,
      itemName: variantItem.name,
      price: opts.price,
      cgstPct: variantItem.cgstPct ?? 0,
      sgstPct: variantItem.sgstPct ?? 0,
      variantId: opts.variantId,
      variantName: opts.variantName,
      selectedModifiers: opts.selectedModifiers,
    });
    setVariantItem(null);
  };

  const handleSendKot = async () => {
    if (unsentCount === 0) return;
    try {
      await sendKot();
    } catch (err: any) {
      console.warn(err.message);
    }
  };

  const handleCheckout = async (paymentData: PaymentData) => {
    setPaymentVisible(false);
    setCheckingOut(true);
    try {
      await checkout(paymentData);
      router.replace('/(tabs)/tables');
    } catch (err: any) {
      console.warn(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleHold = async () => {
    await holdOrder();
    router.replace('/(tabs)/tables');
  };

  // Takeaway/delivery don't require a table
  const noTable = !table && orderType === 'dine_in';

  if (noTable) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">No table selected.</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/tables')} className="mt-4">
          <Text className="text-amber-600 font-semibold">Go to Tables</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row bg-gray-50">
      {scanning && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScanning(false)}
          codeTypes={['ean-13', 'ean-8', 'code-128', 'qr']}
        />
      )}

      {variantItem && (
        <VariantModifierModal
          visible={!!variantItem}
          itemServerId={variantItem.serverId}
          itemName={variantItem.name}
          basePrice={variantItem.price}
          cgstPct={variantItem.cgstPct ?? 0}
          sgstPct={variantItem.sgstPct ?? 0}
          hasVariants={variantItem.hasVariants}
          hasModifiers={variantItem.hasModifiers}
          onAdd={handleVariantAdd}
          onClose={() => setVariantItem(null)}
        />
      )}

      <PaymentModal
        visible={paymentVisible}
        netPayable={netPayable}
        cgstTotal={cgstTotal}
        sgstTotal={sgstTotal}
        subtotal={subtotal}
        onConfirm={handleCheckout}
        onClose={() => setPaymentVisible(false)}
      />

      {/* ── Left: Item grid ── */}
      <View className="flex-1">
        {/* Top bar */}
        <View className="bg-white border-b border-gray-200 pt-12 pb-2 px-4">
          <View className="flex-row items-center justify-between mb-2">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-amber-600 text-sm">← Back</Text>
            </TouchableOpacity>
            <Text className="font-semibold text-gray-800">{table?.name ?? orderType}</Text>
            <TouchableOpacity onPress={() => setScanning(true)}>
              <Text className="text-amber-600 text-sm">Scan</Text>
            </TouchableOpacity>
          </View>

          {/* Order type selector */}
          <View className="flex-row gap-1 mb-2">
            {ORDER_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setOrderType(t.key)}
                className={`flex-1 py-1.5 rounded-lg items-center ${orderType === t.key ? 'bg-amber-500' : 'bg-gray-100'}`}
              >
                <Text className={`text-xs font-medium ${orderType === t.key ? 'text-white' : 'text-gray-500'}`}>
                  {t.label}
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

        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-white border-b border-gray-100 max-h-10"
          contentContainerStyle={{ paddingHorizontal: 8 }}
        >
          <TouchableOpacity
            onPress={() => setActiveGroupId('all')}
            className={`px-3 py-2 mr-1 border-b-2 ${activeGroupId === 'all' ? 'border-amber-500' : 'border-transparent'}`}
          >
            <Text className={activeGroupId === 'all' ? 'text-amber-600 font-semibold text-xs' : 'text-gray-500 text-xs'}>All</Text>
          </TouchableOpacity>
          {itemGroups.map((g) => (
            <TouchableOpacity
              key={g.id}
              onPress={() => setActiveGroupId(g.id)}
              className={`px-3 py-2 mr-1 border-b-2 ${activeGroupId === g.id ? 'border-amber-500' : 'border-transparent'}`}
            >
              <Text className={activeGroupId === g.id ? 'text-amber-600 font-semibold text-xs' : 'text-gray-500 text-xs'}>
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Items */}
        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: 4 }}
          renderItem={({ item }) => (
            <ItemCard item={item} onPress={() => handleItemPress(item)} />
          )}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-gray-400">No items found.</Text>
            </View>
          }
        />
      </View>

      {/* ── Right: Cart ── */}
      <View className="w-60 bg-white border-l border-gray-200 flex-col">
        <View className="border-b border-gray-100 px-3 py-3 pt-12">
          <Text className="font-bold text-gray-800 text-base">Cart</Text>
          <Text className="text-gray-400 text-xs">{table?.name ?? orderType}</Text>
        </View>

        <ScrollView className="flex-1 px-2 py-1">
          {lines.length === 0 && (
            <Text className="text-gray-400 text-xs text-center mt-8">Cart is empty</Text>
          )}
          {lines.map((line) => (
            <View key={line.lineId} className="py-2 border-b border-gray-50">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-1">
                  <Text className="text-gray-800 text-xs font-medium" numberOfLines={2}>
                    {line.itemName}
                    {line.variantName ? ` (${line.variantName})` : ''}
                    {line.sent ? ' ✓' : ''}
                  </Text>
                </View>
                <Text className="text-amber-600 text-xs font-semibold">
                  {formatCurrency(line.price * line.quantity)}
                </Text>
              </View>

              <ChefNoteInput lineId={line.lineId} note={line.note} sent={line.sent} />

              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-center">
                  {!line.sent && (
                    <TouchableOpacity
                      onPress={() => decrementQty(line.lineId)}
                      className="w-6 h-6 bg-gray-100 rounded items-center justify-center"
                    >
                      <Text className="text-gray-600 font-bold">−</Text>
                    </TouchableOpacity>
                  )}
                  <Text className="text-gray-700 text-xs mx-2">{line.quantity}</Text>
                  {!line.sent && (
                    <TouchableOpacity
                      onPress={() => incrementQty(line.lineId)}
                      className="w-6 h-6 bg-gray-100 rounded items-center justify-center"
                    >
                      <Text className="text-gray-600 font-bold">+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Totals + actions */}
        <View className="px-3 pb-6 pt-2 border-t border-gray-100">
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-gray-400 text-xs">Subtotal</Text>
            <Text className="text-gray-600 text-xs">{formatCurrency(subtotal)}</Text>
          </View>
          {cgstTotal > 0 && (
            <>
              <View className="flex-row justify-between mb-0.5">
                <Text className="text-gray-400 text-xs">CGST</Text>
                <Text className="text-gray-600 text-xs">{formatCurrency(cgstTotal)}</Text>
              </View>
              <View className="flex-row justify-between mb-0.5">
                <Text className="text-gray-400 text-xs">SGST</Text>
                <Text className="text-gray-600 text-xs">{formatCurrency(sgstTotal)}</Text>
              </View>
            </>
          )}
          <View className="flex-row justify-between mb-3 mt-1 border-t border-gray-100 pt-1">
            <Text className="text-gray-700 text-sm font-semibold">Total</Text>
            <Text className="font-bold text-gray-800">{formatCurrency(netPayable)}</Text>
          </View>

          <TouchableOpacity
            className={`py-3 rounded-lg items-center mb-2 ${unsentCount > 0 ? 'bg-amber-500' : 'bg-gray-200'}`}
            onPress={handleSendKot}
            disabled={unsentCount === 0}
          >
            <Text className={`font-semibold text-sm ${unsentCount > 0 ? 'text-white' : 'text-gray-400'}`}>
              Send KOT {unsentCount > 0 ? `(${unsentCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-green-500 py-3 rounded-lg items-center mb-2"
            onPress={() => setPaymentVisible(true)}
            disabled={checkingOut || lines.length === 0}
          >
            {checkingOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-sm">Checkout</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="py-2 items-center" onPress={handleHold}>
            <Text className="text-gray-400 text-xs">Hold Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const enhance = withObservables([], () => ({
  items: database.get<Item>('items').query(Q.where('is_active', true)),
  itemGroups: database.get<ItemGroup>('item_groups').query(),
}));

export default (enhance(BillingScreen as any) as any);
