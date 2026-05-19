import React, {useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import {database} from '@/src/db';
import {useTheme} from '@/src/store/themeStore';
import {deleteItem} from '@/src/api/inventory';
import type Item from '@/src/db/models/Item';
import type {RootStackParamList} from '@/src/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  items: Item[];
}

function InventoryItemsScreen({items}: Props) {
  const nav = useNavigation<Nav>();
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const filtered = items.filter(it =>
    it.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDelete(item: Item) {
    Alert.alert('Delete Item', `Remove "${item.name}" from menu?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await item.update((r: any) => {
              r._raw.is_active = false;
              r._raw.sync_state = 'pending';
            });
          });
          if (item.serverId && !item.serverId.startsWith('local_')) {
            deleteItem(item.serverId).catch(() => {});
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          {backgroundColor: theme.surface, borderColor: theme.border},
        ]}>
        <TextInput
          style={[styles.searchInput, {color: theme.textPrimary, backgroundColor: theme.surfaceAlt}]}
          placeholder="Search items…"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => nav.navigate('InventoryItemForm', {id: 'new'})}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={it => it.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{color: theme.textMuted}}>No items found.</Text>
          </View>
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={[
              styles.row,
              {backgroundColor: theme.surface, borderColor: theme.borderLight},
            ]}
            onPress={() => nav.navigate('InventoryItemForm', {id: item.id})}
            activeOpacity={0.7}>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, {color: theme.textPrimary}]}>
                {item.name}
              </Text>
              <Text style={[styles.rowMeta, {color: theme.textSecondary}]}>
                ₹{item.price.toFixed(2)}
                {item.cgstPct != null && item.cgstPct > 0
                  ? ` · GST ${(item.cgstPct + (item.sgstPct ?? 0)).toFixed(0)}%`
                  : ''}
                {item.unit ? ` · ${item.unit}` : ''}
              </Text>
            </View>
            {item.hasVariants && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Variants</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const enhance = withObservables([], () => ({
  items: database
    .get<Item>('items')
    .query(Q.where('is_active', true), Q.sortBy('name', Q.asc)),
}));

export default enhance(InventoryItemsScreen as any) as any;

const styles = StyleSheet.create({
  screen: {flex: 1},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 44,
  },
  addBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  list: {paddingBottom: 32},
  empty: {alignItems: 'center', paddingTop: 48},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  rowBody: {flex: 1},
  rowName: {fontSize: 14, fontWeight: '500'},
  rowMeta: {fontSize: 12, marginTop: 2},
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeText: {color: '#2563eb', fontSize: 11, fontWeight: '600'},
  deleteBtn: {paddingHorizontal: 8, paddingVertical: 4, minHeight: 44, justifyContent: 'center'},
  deleteBtnText: {color: '#dc2626', fontSize: 13},
});
