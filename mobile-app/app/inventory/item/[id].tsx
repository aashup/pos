import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import { createItem, updateItem, createVariant, deleteVariant } from '@/api/inventory';
import type Item from '@/db/models/Item';
import type ItemVariant from '@/db/models/ItemVariant';

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ItemFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [sku, setSku] = useState('');
  const [cgstPct, setCgstPct] = useState('');
  const [sgstPct, setSgstPct] = useState('');

  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');

  const [localItem, setLocalItem] = useState<Item | null>(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const item = await database.get<Item>('items').find(id!);
      setLocalItem(item);
      setName(item.name);
      setPrice(String(item.price));
      setUnit(item.unit ?? 'PCS');
      setSku(item.sku ?? '');
      setCgstPct(item.cgstPct != null ? String(item.cgstPct) : '');
      setSgstPct(item.sgstPct != null ? String(item.sgstPct) : '');

      const vs = await database
        .get<ItemVariant>('item_variants')
        .query(Q.where('item_server_id', item.serverId), Q.where('sync_status', Q.notEq('deleted')))
        .fetch();
      setVariants(vs);
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { Alert.alert('Validation', 'Enter a valid price'); return; }
    setSaving(true);

    try {
      const cgst = cgstPct ? parseFloat(cgstPct) : 0;
      const sgst = sgstPct ? parseFloat(sgstPct) : 0;

      if (isNew) {
        // Write to WatermelonDB first
        let serverItemId = '';
        await database.write(async () => {
          const rec = await database.get<Item>('items').create((r: any) => {
            r._raw.server_id = generateLocalId();
            r._raw.name = name.trim();
            r._raw.price = priceNum;
            r._raw.unit = unit;
            r._raw.sku = sku;
            r._raw.cgst_pct = cgst;
            r._raw.sgst_pct = sgst;
            r._raw.gst_rate = cgst + sgst;
            r._raw.is_active = true;
            r._raw.has_variants = false;
            r._raw.has_modifiers = false;
            r._raw.sync_status = 'pending';
          });
          serverItemId = rec.serverId;
        });
        // Fire-and-forget push
        createItem({
          name: name.trim(), unit, sale_price: priceNum,
          cgst, sgst, is_active: true, sku: sku || undefined,
        }).catch(() => {});
      } else if (localItem) {
        await database.write(async () => {
          await localItem.update((r: any) => {
            r._raw.name = name.trim();
            r._raw.price = priceNum;
            r._raw.unit = unit;
            r._raw.sku = sku;
            r._raw.cgst_pct = cgst;
            r._raw.sgst_pct = sgst;
            r._raw.gst_rate = cgst + sgst;
            r._raw.sync_status = 'pending';
          });
        });
        if (localItem.serverId && !localItem.serverId.startsWith('local_')) {
          updateItem(localItem.serverId, {
            name: name.trim(), unit, sale_price: priceNum, cgst, sgst, sku: sku || undefined,
          }).catch(() => {});
        }
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async () => {
    if (!localItem) return;
    if (!newVariantName.trim()) return;
    const variantPrice = parseFloat(newVariantPrice);
    if (isNaN(variantPrice)) { Alert.alert('Validation', 'Enter a valid variant price'); return; }

    await database.write(async () => {
      await database.get<ItemVariant>('item_variants').create((r: any) => {
        r._raw.server_id = generateLocalId();
        r._raw.item_server_id = localItem.serverId;
        r._raw.name = newVariantName.trim();
        r._raw.price = variantPrice;
        r._raw.is_active = true;
        r._raw.sync_status = 'pending';
      });
      await localItem.update((r: any) => { r._raw.has_variants = true; });
    });

    createVariant({
      item_id: localItem.serverId,
      name: newVariantName.trim(),
      price: variantPrice,
    }).catch(() => {});

    setNewVariantName('');
    setNewVariantPrice('');

    const vs = await database
      .get<ItemVariant>('item_variants')
      .query(Q.where('item_server_id', localItem.serverId), Q.where('sync_status', Q.notEq('deleted')))
      .fetch();
    setVariants(vs);
  };

  const handleDeleteVariant = async (variant: ItemVariant) => {
    await database.write(async () => {
      await variant.update((r: any) => { r._raw.sync_status = 'deleted'; });
    });
    if (variant.serverId && !variant.serverId.startsWith('local_')) {
      deleteVariant(variant.serverId).catch(() => {});
    }
    setVariants((prev) => prev.filter((v) => v.id !== variant.id));
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Text className="text-amber-600">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">{isNew ? 'New Item' : 'Edit Item'}</Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-amber-500 px-4 py-1.5 rounded-lg">
          <Text className="text-white font-semibold text-sm">{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Basic fields */}
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Details</Text>

          {[
            { label: 'Name *', value: name, onChange: setName, placeholder: 'Item name', keyboardType: 'default' as const },
            { label: 'Price (₹) *', value: price, onChange: setPrice, placeholder: '0.00', keyboardType: 'decimal-pad' as const },
            { label: 'Unit', value: unit, onChange: setUnit, placeholder: 'PCS', keyboardType: 'default' as const },
            { label: 'SKU', value: sku, onChange: setSku, placeholder: 'Optional', keyboardType: 'default' as const },
          ].map((f, i, arr) => (
            <View key={f.label} className={`px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <Text className="text-xs text-gray-400 mb-1">{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChange}
                placeholder={f.placeholder}
                keyboardType={f.keyboardType}
                className="text-gray-800 text-sm"
              />
            </View>
          ))}
        </View>

        {/* GST */}
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">GST</Text>
          <View className="flex-row">
            <View className="flex-1 px-4 py-3 border-b border-gray-100 border-r border-gray-100">
              <Text className="text-xs text-gray-400 mb-1">CGST %</Text>
              <TextInput
                value={cgstPct}
                onChangeText={setCgstPct}
                placeholder="0"
                keyboardType="decimal-pad"
                className="text-gray-800 text-sm"
              />
            </View>
            <View className="flex-1 px-4 py-3 border-b border-gray-100">
              <Text className="text-xs text-gray-400 mb-1">SGST %</Text>
              <TextInput
                value={sgstPct}
                onChangeText={setSgstPct}
                placeholder="0"
                keyboardType="decimal-pad"
                className="text-gray-800 text-sm"
              />
            </View>
          </View>
        </View>

        {/* Variants (only visible when editing an existing item) */}
        {!isNew && (
          <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
            <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Variants</Text>

            {variants.map((v, i) => (
              <View key={v.id} className={`flex-row items-center px-4 py-3 ${i < variants.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <Text className="flex-1 text-gray-700 text-sm">{v.name}</Text>
                <Text className="text-gray-500 text-sm mr-3">₹{v.price.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleDeleteVariant(v)}>
                  <Text className="text-red-400 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View className="flex-row px-4 py-3 border-t border-gray-100 gap-2">
              <TextInput
                value={newVariantName}
                onChangeText={setNewVariantName}
                placeholder="Variant name"
                className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
              />
              <TextInput
                value={newVariantPrice}
                onChangeText={setNewVariantPrice}
                placeholder="₹0"
                keyboardType="decimal-pad"
                className="w-20 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
              />
              <TouchableOpacity
                onPress={handleAddVariant}
                className="bg-amber-500 px-3 py-2 rounded-lg justify-center"
              >
                <Text className="text-white font-semibold text-sm">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
