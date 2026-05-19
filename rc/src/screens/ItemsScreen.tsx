import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import withObservables from '@nozbe/with-observables';

import {itemsCollection} from '@/src/db';
import Item from '@/src/db/models/Item';
import {createItem} from '@/src/lib/itemActions';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import {useSyncStore} from '@/src/store/syncStore';
import {useTheme} from '@/src/store/themeStore';

type ItemRowProps = {item: Item};

function ItemRow({item}: ItemRowProps) {
  const theme = useTheme();
  const badgeColor =
    item.syncState === 'synced'  ? '#22c55e' :
    item.syncState === 'pending' ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.row, {backgroundColor: theme.surface, borderBottomColor: theme.borderLight}]}>
      <View style={{flex: 1}}>
        <Text style={[styles.itemName, {color: theme.textPrimary}]}>{item.name}</Text>
        <Text style={[styles.itemMeta, {color: theme.textSecondary}]}>
          ₹{item.price.toFixed(2)} · {item.unit ?? '—'}
        </Text>
      </View>
      <View style={[styles.badge, {backgroundColor: badgeColor}]}>
        <Text style={styles.badgeText}>{item.syncState}</Text>
      </View>
    </View>
  );
}

type ItemsListProps = {items: Item[]};

function ItemsListInner({items}: ItemsListProps) {
  const theme = useTheme();
  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      renderItem={({item}) => <ItemRow item={item} />}
      ListEmptyComponent={
        <Text style={[styles.empty, {color: theme.textMuted}]}>
          No items yet. Add one above.
        </Text>
      }
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
    />
  );
}

const ObservableItemsList = withObservables([], () => ({
  items: itemsCollection.query().observeWithColumns([
    'name',
    'price',
    'unit',
    'sync_state',
  ]),
}))(ItemsListInner);

export default function ItemsScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const status = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);

  async function handleAdd() {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum)) {
      Alert.alert('Invalid input', 'Name and price are required');
      return;
    }
    await createItem({name: name.trim(), price: priceNum, unit: 'PCS'});
    setName('');
    setPrice('');
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.syncBar, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
        <Text style={[styles.syncState, {color: theme.textSecondary}]}>
          sync: {status}
          {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
        </Text>
        <TouchableOpacity style={styles.syncBtn} onPress={triggerSyncNow}>
          <Text style={styles.syncBtnText}>Sync now</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.form, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
        <TextInput
          style={[styles.input, {backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary}]}
          placeholder="Item name"
          placeholderTextColor={theme.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, {backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary}]}
          placeholder="Price"
          placeholderTextColor={theme.textMuted}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ObservableItemsList />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  syncState: {fontSize: 13},
  syncBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncBtnText: {color: '#fff', fontWeight: '600'},
  form: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 6,
  },
  addBtnText: {color: '#fff', fontWeight: '700'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  itemName: {fontSize: 15, fontWeight: '600'},
  itemMeta: {fontSize: 12, marginTop: 2},
  badge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4},
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  empty: {textAlign: 'center', fontSize: 14},
  emptyContainer: {flex: 1, justifyContent: 'center'},
});
