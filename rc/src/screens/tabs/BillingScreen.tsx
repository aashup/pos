import React, {useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';

import {itemsCollection, itemGroupsCollection} from '@/src/db';
import Item from '@/src/db/models/Item';
import ItemGroup from '@/src/db/models/ItemGroup';
import Header from '@/src/components/Header';
import ItemCard from '@/src/components/pos/ItemCard';
import Cart from '@/src/components/pos/Cart';
import VariantModifierModal from '@/src/components/pos/VariantModifierModal';
import PaymentModal, {PaymentModalResult} from '@/src/components/pos/PaymentModal';
import {useCartStore} from '@/src/store/cartStore';
import {useTheme} from '@/src/store/themeStore';
import {sendKot, checkoutOrder, startOrder} from '@/src/lib/orderActions';
import {formatCurrency} from '@/src/lib/utils';
import type {RootStackParamList} from '@/src/navigation/types';

type Props = {items: Item[]; groups: ItemGroup[]};

function BillingScreenInner({items, groups}: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();

  const localOrderId = useCartStore(s => s.localOrderId);
  const lines = useCartStore(s => s.lines);
  const table = useCartStore(s => s.table);
  const orderType = useCartStore(s => s.orderType);
  const addItem = useCartStore(s => s.addItem);
  const computeTotals = useCartStore(s => s.computeTotals);
  const totals = computeTotals();

  const [groupId, setGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (groupId && it.itemGroupServerId !== groupId) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return it.isActive;
    });
  }, [items, groupId, search]);

  async function ensureOrder() {
    if (localOrderId) return;
    await startOrder({orderType: 'takeaway'});
    useCartStore.getState().setOrderType('takeaway');
  }

  async function handleItemTap(item: Item) {
    await ensureOrder();
    if (item.hasVariants || item.hasModifiers) {
      setModalItem(item);
    } else {
      addItem({
        itemId: item.serverId ?? item.id,
        itemName: item.name,
        price: item.price,
        cgstPct: item.cgstPct ?? 0,
        sgstPct: item.sgstPct ?? 0,
      });
    }
  }

  async function handleSendKot() {
    try {
      await sendKot();
      setCartOpen(false);
    } catch (err: any) {
      Alert.alert('Could not send KOT', err?.message ?? String(err));
    }
  }

  function handlePayPress() {
    setCartOpen(false);
    setPaymentOpen(true);
  }

  async function handleConfirmPayment(result: PaymentModalResult) {
    if (!localOrderId) {
      setPaymentOpen(false);
      return;
    }
    try {
      await checkoutOrder(localOrderId, result as any);
      setPaymentOpen(false);
      Alert.alert('Paid', 'Order confirmed');
      nav.navigate('Tabs' as any, {screen: 'Tables'} as any);
    } catch (err: any) {
      Alert.alert('Checkout failed', err?.message ?? String(err));
    }
  }

  const headerLabel = table?.name ?? (orderType === 'takeaway' ? 'Takeaway' : 'New order');
  const orderTypeSub = orderType.replace('_', ' ');

  const manageBtn = (
    <TouchableOpacity
      style={styles.manageBtn}
      onPress={() => nav.navigate('Items')}>
      <Text style={styles.manageBtnText}>Manage items</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header
        title={headerLabel}
        subtitle={orderTypeSub}
        right={manageBtn}
      />

      <View style={[styles.searchRow, {backgroundColor: theme.surface}]}>
        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textPrimary,
            },
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.groupRow, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}
        contentContainerStyle={styles.groupRowContent}>
        <TouchableOpacity
          style={[
            styles.groupPill,
            {backgroundColor: theme.surface, borderColor: theme.border},
            groupId === null && styles.groupPillActive,
          ]}
          onPress={() => setGroupId(null)}>
          <Text
            style={[
              styles.groupPillText,
              {color: theme.textSecondary},
              groupId === null && styles.groupPillTextActive,
            ]}>
            All
          </Text>
        </TouchableOpacity>
        {groups.map(g => {
          const active = groupId === g.serverId;
          return (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.groupPill,
                {backgroundColor: theme.surface, borderColor: theme.border},
                active && styles.groupPillActive,
              ]}
              onPress={() => setGroupId(g.serverId ?? null)}>
              <Text
                style={[
                  styles.groupPillText,
                  {color: theme.textSecondary},
                  active && styles.groupPillTextActive,
                ]}>
                {g.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({item}) => <ItemCard item={item} onPress={handleItemTap} />}
        numColumns={2}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.grid
        }
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>No items match.</Text>
        }
        style={{flex: 1}}
      />

      {/* Sticky cart summary bar — intentionally dark in both themes */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.summaryBar}
        onPress={() => setCartOpen(true)}>
        <View style={{flex: 1}}>
          <Text style={styles.summaryLabel}>
            {lines.length === 0
              ? 'Cart empty'
              : `${lines.length} line${lines.length === 1 ? '' : 's'} · ${
                  totals.unsentCount
                } pending`}
          </Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totals.netPayable)}</Text>
        </View>
        <Text style={styles.summaryCta}>View cart ›</Text>
      </TouchableOpacity>

      {/* Cart drawer */}
      <Modal
        visible={cartOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCartOpen(false)}>
        <View style={[styles.cartBackdrop, {backgroundColor: theme.scrim}]}>
          <View style={[styles.cartSheet, {backgroundColor: theme.surface}]}>
            <View style={[styles.cartHandle, {borderBottomColor: theme.border}]}>
              <TouchableOpacity onPress={() => setCartOpen(false)}>
                <Text style={[styles.cartHandleClose, {color: theme.textSecondary}]}>
                  ✕ Close
                </Text>
              </TouchableOpacity>
            </View>
            <Cart onSendKot={handleSendKot} onPay={handlePayPress} />
          </View>
        </View>
      </Modal>

      <VariantModifierModal
        visible={modalItem !== null}
        item={modalItem}
        onClose={() => setModalItem(null)}
        onAdd={result => {
          if (!modalItem) return;
          addItem({
            itemId: modalItem.serverId ?? modalItem.id,
            itemName: modalItem.name,
            price: result.price,
            cgstPct: modalItem.cgstPct ?? 0,
            sgstPct: modalItem.sgstPct ?? 0,
            variantId: result.variantId,
            variantName: result.variantName,
            selectedModifiers: result.selectedModifiers,
          });
          setModalItem(null);
        }}
      />

      <PaymentModal
        visible={paymentOpen}
        totals={computeTotals()}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
      />
    </KeyboardAvoidingView>
  );
}

export default withObservables([], () => ({
  items: itemsCollection
    .query(Q.where('is_active', true))
    .observeWithColumns([
      'name',
      'price',
      'unit',
      'is_active',
      'has_variants',
      'has_modifiers',
    ]),
  groups: itemGroupsCollection.query().observeWithColumns(['name']),
}))(BillingScreenInner);

const styles = StyleSheet.create({
  screen: {flex: 1},

  manageBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageBtnText: {color: '#fff', fontWeight: '700', fontSize: 12},

  searchRow: {padding: 8},
  search: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },

  groupRow: {maxHeight: 48, borderBottomWidth: 1},
  groupRowContent: {paddingHorizontal: 6, gap: 6, alignItems: 'center', paddingVertical: 6},
  groupPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  groupPillActive: {backgroundColor: '#0ea5e9', borderColor: '#0ea5e9'},
  groupPillText: {fontSize: 12, fontWeight: '600'},
  groupPillTextActive: {color: '#fff'},

  grid: {padding: 6},
  empty: {textAlign: 'center', padding: 24, fontSize: 13},
  emptyContainer: {flex: 1, justifyContent: 'center'},

  // Intentionally always dark — it's a branded action strip
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  summaryLabel: {fontSize: 11, color: '#94a3b8', textTransform: 'uppercase'},
  summaryAmount: {fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2},
  summaryCta: {color: '#0ea5e9', fontWeight: '700', fontSize: 13},

  cartBackdrop: {flex: 1},
  cartSheet: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  cartHandle: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    borderBottomWidth: 1,
  },
  cartHandleClose: {fontSize: 13, fontWeight: '700'},
});
