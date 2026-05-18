import React, {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Q} from '@nozbe/watermelondb';
import {
  itemVariantsCollection,
  modifierGroupsCollection,
  modifiersCollection,
} from '@/src/db';
import Item from '@/src/db/models/Item';
import ItemVariant from '@/src/db/models/ItemVariant';
import ModifierGroup from '@/src/db/models/ModifierGroup';
import Modifier from '@/src/db/models/Modifier';
import {SelectedModifier} from '@/src/store/cartStore';
import {formatCurrency} from '@/src/lib/utils';

type Props = {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  onAdd: (args: {
    price: number;
    variantId: string | null;
    variantName: string | null;
    selectedModifiers: SelectedModifier[];
  }) => void;
};

export default function VariantModifierModal({visible, item, onClose, onAdd}: Props) {
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [modifiersByGroup, setModifiersByGroup] = useState<Record<string, Modifier[]>>({});

  const [variantId, setVariantId] = useState<string | null>(null);
  const [selectedModIds, setSelectedModIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !item || !item.serverId) {
      setVariants([]);
      setGroups([]);
      setModifiersByGroup({});
      setVariantId(null);
      setSelectedModIds(new Set());
      return;
    }
    (async () => {
      const vs = item.hasVariants
        ? await itemVariantsCollection
            .query(Q.where('item_server_id', item.serverId!), Q.where('is_active', true))
            .fetch()
        : [];
      const gs = item.hasModifiers
        ? await modifierGroupsCollection
            .query(Q.where('item_server_id', item.serverId!))
            .fetch()
        : [];
      const modMap: Record<string, Modifier[]> = {};
      for (const g of gs) {
        const ms = await modifiersCollection
          .query(
            Q.where('modifier_group_server_id', g.serverId!),
            Q.where('is_active', true),
          )
          .fetch();
        modMap[g.serverId!] = ms;
      }
      setVariants(vs);
      setGroups(gs);
      setModifiersByGroup(modMap);
      // Auto-pick first variant if there's only one
      if (vs.length === 1) setVariantId(vs[0].serverId);
    })();
  }, [visible, item]);

  const selectedVariant = useMemo(
    () => variants.find(v => v.serverId === variantId) ?? null,
    [variants, variantId],
  );

  const previewPrice = useMemo(() => {
    if (!item) return 0;
    const base = selectedVariant ? selectedVariant.price : item.price;
    let modAdd = 0;
    for (const [gId, mods] of Object.entries(modifiersByGroup)) {
      for (const m of mods) {
        if (selectedModIds.has(m.serverId!)) modAdd += m.price;
      }
    }
    return base + modAdd;
  }, [item, selectedVariant, modifiersByGroup, selectedModIds]);

  function toggleMod(group: ModifierGroup, mod: Modifier) {
    const next = new Set(selectedModIds);
    const gMods = modifiersByGroup[group.serverId!] ?? [];
    const inGroupSelected = gMods.filter(m => next.has(m.serverId!));

    if (next.has(mod.serverId!)) {
      next.delete(mod.serverId!);
    } else {
      if (group.maxSelections === 1) {
        // Radio: replace current selection in this group
        for (const sel of inGroupSelected) next.delete(sel.serverId!);
        next.add(mod.serverId!);
      } else if (inGroupSelected.length >= group.maxSelections) {
        // Cap reached — no-op
        return;
      } else {
        next.add(mod.serverId!);
      }
    }
    setSelectedModIds(next);
  }

  function canAdd(): boolean {
    if (!item) return false;
    if (item.hasVariants && variants.length > 0 && !variantId) return false;
    for (const g of groups) {
      const selectedCount = (modifiersByGroup[g.serverId!] ?? []).filter(m =>
        selectedModIds.has(m.serverId!),
      ).length;
      if (g.isRequired && selectedCount < g.minSelections) return false;
    }
    return true;
  }

  function handleAddPress() {
    if (!item) return;
    const selectedMods: SelectedModifier[] = [];
    for (const mods of Object.values(modifiersByGroup)) {
      for (const m of mods) {
        if (selectedModIds.has(m.serverId!)) {
          selectedMods.push({id: m.serverId!, name: m.name, price: m.price});
        }
      }
    }
    onAdd({
      price: selectedVariant ? selectedVariant.price : item.price,
      variantId: selectedVariant?.serverId ?? null,
      variantName: selectedVariant?.name ?? null,
      selectedModifiers: selectedMods,
    });
  }

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 12}}>
            {variants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Variant {variants.length > 0 ? <Text style={styles.req}>· required</Text> : null}
                </Text>
                <View style={styles.choiceGrid}>
                  {variants.map(v => {
                    const active = v.serverId === variantId;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setVariantId(v.serverId)}
                        style={[styles.choice, active && styles.choiceActive]}>
                        <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                          {v.name}
                        </Text>
                        <Text style={[styles.choicePrice, active && styles.choiceLabelActive]}>
                          {formatCurrency(v.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {groups.map(g => {
              const gMods = modifiersByGroup[g.serverId!] ?? [];
              return (
                <View key={g.id} style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    {g.name}{' '}
                    <Text style={styles.req}>
                      {g.isRequired ? '· required' : ''}
                      {g.maxSelections > 1 ? ` · max ${g.maxSelections}` : ''}
                    </Text>
                  </Text>
                  <View style={styles.choiceGrid}>
                    {gMods.map(m => {
                      const active = selectedModIds.has(m.serverId!);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => toggleMod(g, m)}
                          style={[styles.choice, active && styles.choiceActive]}>
                          <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                            {m.name}
                          </Text>
                          {m.price > 0 && (
                            <Text style={[styles.choicePrice, active && styles.choiceLabelActive]}>
                              +{formatCurrency(m.price)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {variants.length === 0 && groups.length === 0 && (
              <Text style={styles.empty}>No variants or modifiers for this item.</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceValue}>{formatCurrency(previewPrice)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, !canAdd() && styles.addBtnDisabled]}
              onPress={handleAddPress}
              disabled={!canAdd()}>
              <Text style={styles.addBtnText}>Add to cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end'},
  sheet: {
    maxHeight: '85%',
    minHeight: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a'},
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {fontSize: 18, color: '#475569'},

  section: {marginBottom: 14},
  sectionLabel: {fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8},
  req: {fontSize: 11, color: '#dc2626', fontWeight: '600'},

  choiceGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  choice: {
    minWidth: '30%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  choiceActive: {borderColor: '#0ea5e9', backgroundColor: '#e0f2fe'},
  choiceLabel: {fontSize: 13, color: '#0f172a', fontWeight: '600'},
  choiceLabelActive: {color: '#075985'},
  choicePrice: {fontSize: 12, color: '#64748b', marginTop: 2},

  empty: {textAlign: 'center', color: '#94a3b8', padding: 16},

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  priceLabel: {fontSize: 11, color: '#64748b'},
  priceValue: {fontSize: 18, fontWeight: '800', color: '#0f172a'},
  addBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addBtnDisabled: {opacity: 0.4},
  addBtnText: {color: '#fff', fontWeight: '700'},
});
