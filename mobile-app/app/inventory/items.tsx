import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { deleteItem } from '@/api/inventory';
import type Item from '@/db/models/Item';
import type { Observable } from 'rxjs';

interface Props {
  items: Item[];
}

function ItemsScreen({ items }: Props) {
  const [search, setSearch] = useState('');

  const filtered = items.filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (item: Item) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await item.update((rec) => {
              (rec as any)._raw.is_active = false;
              (rec as any)._raw.sync_status = 'deleted';
            });
          });
          if (item.serverId) {
            deleteItem(item.serverId).catch(() => {});
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Text className="text-amber-600">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Items</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/inventory/item/new')}
          className="bg-amber-500 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-white font-semibold text-sm">+ Add</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <TextInput
          className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700"
          placeholder="Search items…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-gray-400">No items found.</Text>
          </View>
        ) : (
          filtered.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(`/inventory/item/${item.id}`)}
              className={`flex-row items-center px-4 py-3 bg-white ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <View className="flex-1">
                <Text className="text-gray-800 font-medium">{item.name}</Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  ₹{item.price.toFixed(2)}
                  {item.gstRate ? ` · GST ${item.gstRate}%` : ''}
                  {item.unit ? ` · ${item.unit}` : ''}
                </Text>
              </View>
              {item.hasVariants && (
                <View className="bg-blue-50 px-2 py-0.5 rounded mr-2">
                  <Text className="text-blue-600 text-xs">Variants</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                className="px-3 py-1"
              >
                <Text className="text-red-400 text-sm">Delete</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const enhance = withObservables([], () => ({
  items: database
    .get<Item>('items')
    .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
    .observe() as Observable<Item[]>,
}));

export default enhance(ItemsScreen);
