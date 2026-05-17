import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/db';
import { formatCurrency } from '@/src/lib/utils';
import type ItemVariant from '@/src/db/models/ItemVariant';
import type ModifierGroup from '@/src/db/models/ModifierGroup';
import type Modifier from '@/src/db/models/Modifier';
import type { SelectedModifier } from '@/src/store/cartStore';

interface Props {
  visible: boolean;
  itemServerId: string;
  itemName: string;
  basePrice: number;
  cgstPct: number;
  sgstPct: number;
  hasVariants: boolean;
  hasModifiers: boolean;
  onAdd: (opts: {
    price: number;
    variantId: string | null;
    variantName: string | null;
    selectedModifiers: SelectedModifier[];
  }) => void;
  onClose: () => void;
}

export function VariantModifierModal({
  visible,
  itemServerId,
  itemName,
  basePrice,
  cgstPct,
  sgstPct,
  hasVariants,
  hasModifiers,
  onAdd,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [groups, setGroups] = useState<Array<{ group: ModifierGroup; modifiers: Modifier[] }>>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifierIds, setSelectedModifierIds] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSelectedVariantId(null);
    setSelectedModifierIds({});

    (async () => {
      const [vars, mGroups] = await Promise.all([
        hasVariants
          ? database.get<ItemVariant>('item_variants').query(
              Q.and(Q.where('item_server_id', itemServerId), Q.where('is_active', true)),
            ).fetch()
          : Promise.resolve([]),
        hasModifiers
          ? database.get<ModifierGroup>('modifier_groups').query(
              Q.where('item_server_id', itemServerId),
            ).fetch()
          : Promise.resolve([]),
      ]);

      const groupsWithMods = await Promise.all(
        mGroups.map(async (g) => ({
          group: g,
          modifiers: await database
            .get<Modifier>('modifiers')
            .query(Q.and(Q.where('modifier_group_id', g.id), Q.where('is_active', true)))
            .fetch(),
        })),
      );

      setVariants(vars);
      setGroups(groupsWithMods);
      setLoading(false);
    })();
  }, [visible, itemServerId, hasVariants, hasModifiers]);

  const selectedVariant = variants.find((v) => v.serverId === selectedVariantId);
  const modifiersTotal = groups.reduce((sum, { modifiers }) => {
    const ids = selectedModifierIds[modifiers[0]?.modifierGroupId ?? ''] ?? [];
    return sum + modifiers.filter((m) => ids.includes(m.id)).reduce((s, m) => s + m.price, 0);
  }, 0);
  const effectivePrice = (selectedVariant?.price ?? basePrice) + modifiersTotal;

  const canAdd = !hasVariants || selectedVariantId !== null;

  const toggleModifier = (groupLocalId: string, modId: string, maxSel: number) => {
    setSelectedModifierIds((prev) => {
      const cur = prev[groupLocalId] ?? [];
      if (cur.includes(modId)) {
        return { ...prev, [groupLocalId]: cur.filter((id) => id !== modId) };
      }
      if (maxSel === 1) {
        return { ...prev, [groupLocalId]: [modId] };
      }
      if (cur.length >= maxSel) return prev;
      return { ...prev, [groupLocalId]: [...cur, modId] };
    });
  };

  const handleAdd = () => {
    const selectedMods: SelectedModifier[] = [];
    for (const { modifiers } of groups) {
      const groupId = modifiers[0]?.modifierGroupId ?? '';
      const ids = selectedModifierIds[groupId] ?? [];
      for (const m of modifiers.filter((mod) => ids.includes(mod.id))) {
        selectedMods.push({ id: m.serverId, name: m.name, price: m.price });
      }
    }
    onAdd({
      price: effectivePrice,
      variantId: selectedVariant?.serverId ?? null,
      variantName: selectedVariant?.name ?? null,
      selectedModifiers: selectedMods,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[85%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800" numberOfLines={1}>{itemName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-400 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#d97706" className="my-8" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Variants */}
              {variants.length > 0 && (
                <View className="mb-5">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Choose Variant <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {variants.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setSelectedVariantId(v.serverId)}
                        className={`px-3 py-2.5 rounded-xl border ${
                          selectedVariantId === v.serverId
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <Text className={`text-sm font-medium ${selectedVariantId === v.serverId ? 'text-white' : 'text-gray-700'}`}>
                          {v.name}
                        </Text>
                        <Text className={`text-xs mt-0.5 ${selectedVariantId === v.serverId ? 'text-amber-100' : 'text-gray-400'}`}>
                          {formatCurrency(v.price)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Modifier Groups */}
              {groups.map(({ group, modifiers }) => (
                <View key={group.id} className="mb-5">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-sm font-semibold text-gray-700">{group.name}</Text>
                    {group.isRequired && (
                      <View className="bg-red-100 px-2 py-0.5 rounded">
                        <Text className="text-red-600 text-xs">Required</Text>
                      </View>
                    )}
                    {group.maxSelections > 1 && (
                      <Text className="text-gray-400 text-xs">Choose up to {group.maxSelections}</Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {modifiers.map((m) => {
                      const groupId = m.modifierGroupId;
                      const isSelected = (selectedModifierIds[groupId] ?? []).includes(m.id);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => toggleModifier(groupId, m.id, group.maxSelections)}
                          className={`px-3 py-2.5 rounded-xl border ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            {m.name}
                          </Text>
                          {m.price > 0 && (
                            <Text className={`text-xs mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                              +{formatCurrency(m.price)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <View className="h-4" />
            </ScrollView>
          )}

          {/* Price preview + Add button */}
          <View className="border-t border-gray-100 pt-4 mt-2">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-500 text-sm">Total</Text>
              <Text className="text-gray-800 font-bold text-base">{formatCurrency(effectivePrice)}</Text>
            </View>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!canAdd}
              className={`py-4 rounded-2xl items-center ${canAdd ? 'bg-amber-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-base ${canAdd ? 'text-white' : 'text-gray-400'}`}>
                Add to Cart
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
