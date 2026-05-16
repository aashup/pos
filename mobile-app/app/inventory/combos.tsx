import { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import { createCombo, deleteCombo } from '@/api/inventory';
import type Combo from '@/db/models/Combo';
import type ComboItem from '@/db/models/ComboItem';
import type Item from '@/db/models/Item';
import type { Observable } from 'rxjs';

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ComboCardProps {
  combo: Combo;
  comboItems: ComboItem[];
  allItems: Item[];
}

function ComboCard({ combo, comboItems, allItems }: ComboCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getItemName = (serverItemId: string) => {
    const item = allItems.find((i) => i.serverId === serverItemId);
    return item?.name ?? serverItemId;
  };

  const handleDelete = () => {
    Alert.alert('Delete Combo', `Remove combo "${combo.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await combo.update((r: any) => {
              r._raw.sync_status = 'deleted';
              r._raw.is_active = false;
            });
          });
          if (combo.serverId && !combo.serverId.startsWith('local_')) {
            deleteCombo(combo.serverId).catch(() => {});
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3"
    >
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1">
          <Text className="text-gray-800 font-semibold">{combo.name}</Text>
          <Text className="text-gray-400 text-xs">₹{combo.price.toFixed(2)} · {comboItems.length} items</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} className="px-3 py-1 mr-1">
          <Text className="text-red-400 text-sm">Delete</Text>
        </TouchableOpacity>
        <Text className="text-gray-400">{expanded ? '▲' : '▼'}</Text>
      </View>

      {expanded && comboItems.length > 0 && (
        <View className="border-t border-gray-100 px-4 pb-3">
          {comboItems.map((ci, i) => (
            <View key={ci.id} className={`flex-row py-2 ${i < comboItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <Text className="flex-1 text-gray-600 text-sm">{getItemName(ci.itemServerId)}</Text>
              <Text className="text-gray-400 text-sm">×{ci.quantity}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const EnhancedComboCard = withObservables(['combo'], ({ combo, allItems }: { combo: Combo; allItems: Item[] }) => ({
  combo,
  comboItems: combo.comboItems.observe() as Observable<ComboItem[]>,
  allItems: Promise.resolve(allItems),
}))(ComboCard);

interface ScreenProps {
  combos: Combo[];
  allItems: Item[];
}

function CombosScreen({ combos, allItems }: ScreenProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedItems, setSelectedItems] = useState<Array<{ serverId: string; qty: number }>>([]);
  const [itemSearch, setItemSearch] = useState('');

  const visible = combos.filter((c) => c.syncStatus !== 'deleted' && c.isActive);

  const filteredItems = allItems.filter(
    (it) => it.isActive && it.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const toggleItem = (serverId: string) => {
    setSelectedItems((prev) => {
      const exists = prev.find((s) => s.serverId === serverId);
      if (exists) return prev.filter((s) => s.serverId !== serverId);
      return [...prev, { serverId, qty: 1 }];
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) { Alert.alert('Validation', 'Enter a valid price'); return; }

    const localId = generateLocalId();

    await database.write(async () => {
      await database.get<Combo>('combos').create((r: any) => {
        r._raw.server_id = localId;
        r._raw.name = newName.trim();
        r._raw.price = price;
        r._raw.is_active = true;
        r._raw.sync_status = 'pending';
      });
      for (const sel of selectedItems) {
        await database.get<ComboItem>('combo_items').create((r: any) => {
          r._raw.combo_server_id = localId;
          r._raw.item_server_id = sel.serverId;
          r._raw.quantity = sel.qty;
        });
      }
    });

    createCombo({ name: newName.trim(), price, is_active: true }).catch(() => {});

    setNewName('');
    setNewPrice('');
    setSelectedItems([]);
    setItemSearch('');
    setShowNew(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Text className="text-amber-600">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Combos</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowNew(true)}
          className="bg-amber-500 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-white font-semibold text-sm">+ Combo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {visible.length === 0 ? (
          <Text className="text-center text-gray-400 mt-8">No combos yet.</Text>
        ) : (
          visible.map((c) => (
            <EnhancedComboCard key={c.id} combo={c} allItems={allItems} />
          ))
        )}
      </ScrollView>

      <Modal visible={showNew} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-2xl" style={{ maxHeight: '80%' }}>
            <View className="px-6 pt-6 pb-3">
              <Text className="text-lg font-bold text-gray-800 mb-4">New Combo</Text>

              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Combo name *"
                className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 mb-3"
                autoFocus
              />
              <TextInput
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="Price (₹) *"
                keyboardType="decimal-pad"
                className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 mb-3"
              />

              <Text className="text-xs text-gray-400 mb-2">Select Items</Text>
              <TextInput
                value={itemSearch}
                onChangeText={setItemSearch}
                placeholder="Search items…"
                className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 mb-2"
              />
            </View>

            <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {filteredItems.map((item) => {
                const isSelected = selectedItems.some((s) => s.serverId === item.serverId);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => toggleItem(item.serverId)}
                    className={`flex-row items-center py-2.5 border-b border-gray-50`}
                  >
                    <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                      {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                    <Text className="flex-1 text-gray-700 text-sm">{item.name}</Text>
                    <Text className="text-gray-400 text-sm">₹{item.price.toFixed(2)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row gap-3 px-6 py-4">
              <TouchableOpacity
                onPress={() => { setShowNew(false); setSelectedItems([]); setNewName(''); setNewPrice(''); }}
                className="flex-1 border border-gray-300 py-3 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                className="flex-1 bg-amber-500 py-3 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const enhance = withObservables([], () => ({
  combos: database
    .get<Combo>('combos')
    .query(Q.sortBy('name', Q.asc))
    .observe() as Observable<Combo[]>,
  allItems: database
    .get<Item>('items')
    .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
    .observe() as Observable<Item[]>,
}));

export default enhance(CombosScreen);
