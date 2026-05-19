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
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import withObservables from '@nozbe/with-observables';

import {itemsCollection} from '@/src/db';
import Item from '@/src/db/models/Item';
import {createItem, createItemWithModifiers} from '@/src/lib/itemActions';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import {useSyncStore} from '@/src/store/syncStore';
import {useTheme} from '@/src/store/themeStore';

// ─── Draft types ────────────────────────────────────────────────────────────

type DraftMod = {key: string; name: string; price: string};
type DraftGroup = {
  key: string;
  name: string;
  isRequired: boolean;
  maxSelections: string;
  modifiers: DraftMod[];
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function emptyGroup(): DraftGroup {
  return {key: uid(), name: '', isRequired: false, maxSelections: '1', modifiers: []};
}

function emptyMod(): DraftMod {
  return {key: uid(), name: '', price: '0'};
}

// ─── Item row ────────────────────────────────────────────────────────────────

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
          {item.hasModifiers ? ' · modifiers' : ''}
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
          No items yet. Tap "+ Add item" to create one.
        </Text>
      }
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
    />
  );
}

const ObservableItemsList = withObservables([], () => ({
  items: itemsCollection.query().observeWithColumns([
    'name', 'price', 'unit', 'sync_state', 'has_modifiers',
  ]),
}))(ItemsListInner);

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ItemsScreen() {
  const theme = useTheme();
  const status    = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);

  const [formOpen, setFormOpen] = useState(false);
  const [itemName, setItemName]  = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [groups, setGroups]       = useState<DraftGroup[]>([]);
  const [saving, setSaving]       = useState(false);

  // ── group helpers ──────────────────────────────────────────────────────────

  function addGroup() {
    setGroups(g => [...g, emptyGroup()]);
  }

  function removeGroup(key: string) {
    setGroups(g => g.filter(x => x.key !== key));
  }

  function patchGroup(key: string, patch: Partial<DraftGroup>) {
    setGroups(g => g.map(x => x.key === key ? {...x, ...patch} : x));
  }

  function addModifier(groupKey: string) {
    setGroups(g => g.map(x =>
      x.key === groupKey ? {...x, modifiers: [...x.modifiers, emptyMod()]} : x,
    ));
  }

  function removeModifier(groupKey: string, modKey: string) {
    setGroups(g => g.map(x =>
      x.key === groupKey
        ? {...x, modifiers: x.modifiers.filter(m => m.key !== modKey)}
        : x,
    ));
  }

  function patchModifier(groupKey: string, modKey: string, patch: Partial<DraftMod>) {
    setGroups(g => g.map(x =>
      x.key === groupKey
        ? {
            ...x,
            modifiers: x.modifiers.map(m =>
              m.key === modKey ? {...m, ...patch} : m,
            ),
          }
        : x,
    ));
  }

  // ── submit ─────────────────────────────────────────────────────────────────

  function resetForm() {
    setItemName(''); setItemPrice(''); setGroups([]);
  }

  async function handleAdd() {
    const priceNum = parseFloat(itemPrice);
    if (!itemName.trim() || isNaN(priceNum)) {
      Alert.alert('Invalid input', 'Name and price are required.');
      return;
    }

    const validGroups = groups.filter(g => g.name.trim());
    const hasModifiers = validGroups.length > 0;

    setSaving(true);
    try {
      if (hasModifiers) {
        await createItemWithModifiers(
          {name: itemName.trim(), price: priceNum, unit: 'PCS'},
          validGroups.map(g => ({
            name: g.name.trim(),
            isRequired: g.isRequired,
            minSelections: g.isRequired ? 1 : 0,
            maxSelections: Math.max(1, parseInt(g.maxSelections, 10) || 1),
            modifiers: g.modifiers
              .filter(m => m.name.trim())
              .map(m => ({name: m.name.trim(), price: parseFloat(m.price) || 0})),
          })),
        );
      } else {
        await createItem({name: itemName.trim(), price: priceNum, unit: 'PCS'});
      }
      resetForm();
      setFormOpen(false);
    } catch (err: any) {
      Alert.alert('Could not save item', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.screen, {backgroundColor: theme.bg}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Sync bar */}
      <View style={[styles.syncBar, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
        <Text style={[styles.syncState, {color: theme.textSecondary}]}>
          sync: {status}
          {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
        </Text>
        <TouchableOpacity style={styles.syncBtn} onPress={triggerSyncNow}>
          <Text style={styles.syncBtnText}>Sync now</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
        <TouchableOpacity style={styles.addItemBtn} onPress={() => setFormOpen(true)}>
          <Text style={styles.addItemBtnText}>+ Add item</Text>
        </TouchableOpacity>
      </View>

      <ObservableItemsList />

      {/* ── Add-item modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={formOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!saving) { resetForm(); setFormOpen(false); } }}>

        <KeyboardAvoidingView
          style={[styles.modalRoot, {backgroundColor: theme.bg}]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Modal header */}
          <View style={[styles.modalHeader, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}>
            <Text style={[styles.modalTitle, {color: theme.textPrimary}]}>Add item</Text>
            <TouchableOpacity
              disabled={saving}
              onPress={() => { resetForm(); setFormOpen(false); }}>
              <Text style={[styles.modalClose, {color: theme.textSecondary}]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{flex: 1}}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled">

            {/* Item basics */}
            <Text style={[styles.sectionLabel, {color: theme.textSecondary}]}>ITEM DETAILS</Text>
            <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
              <TextInput
                style={[styles.input, {borderColor: theme.border, color: theme.textPrimary}]}
                placeholder="Item name"
                placeholderTextColor={theme.textMuted}
                value={itemName}
                onChangeText={setItemName}
              />
              <TextInput
                style={[styles.input, {borderColor: theme.border, color: theme.textPrimary, marginTop: 8}]}
                placeholder="Price  e.g. 120"
                placeholderTextColor={theme.textMuted}
                value={itemPrice}
                onChangeText={setItemPrice}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Modifier groups */}
            <Text style={[styles.sectionLabel, {color: theme.textSecondary, marginTop: 20}]}>
              MODIFIER GROUPS
            </Text>

            {groups.map((group, gi) => (
              <View
                key={group.key}
                style={[styles.card, styles.groupCard, {backgroundColor: theme.surface, borderColor: theme.border}]}>

                {/* Group header row */}
                <View style={styles.groupHeaderRow}>
                  <TextInput
                    style={[styles.groupNameInput, {borderColor: theme.border, color: theme.textPrimary}]}
                    placeholder={`Group ${gi + 1} name  e.g. Spice level`}
                    placeholderTextColor={theme.textMuted}
                    value={group.name}
                    onChangeText={v => patchGroup(group.key, {name: v})}
                  />
                  <TouchableOpacity onPress={() => removeGroup(group.key)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Group options row */}
                <View style={styles.groupOptsRow}>
                  <View style={styles.groupOptItem}>
                    <Text style={[styles.optLabel, {color: theme.textSecondary}]}>Required</Text>
                    <Switch
                      value={group.isRequired}
                      onValueChange={v => patchGroup(group.key, {isRequired: v})}
                      trackColor={{true: '#0ea5e9', false: undefined}}
                    />
                  </View>
                  <View style={styles.groupOptItem}>
                    <Text style={[styles.optLabel, {color: theme.textSecondary}]}>Max picks</Text>
                    <TextInput
                      style={[styles.maxInput, {borderColor: theme.border, color: theme.textPrimary}]}
                      value={group.maxSelections}
                      onChangeText={v => patchGroup(group.key, {maxSelections: v.replace(/[^0-9]/g, '')})}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>

                {/* Modifiers list */}
                {group.modifiers.length > 0 && (
                  <View style={[styles.modifierList, {borderTopColor: theme.border}]}>
                    {group.modifiers.map(mod => (
                      <View key={mod.key} style={styles.modifierRow}>
                        <TextInput
                          style={[styles.modNameInput, {borderColor: theme.border, color: theme.textPrimary}]}
                          placeholder="Option name"
                          placeholderTextColor={theme.textMuted}
                          value={mod.name}
                          onChangeText={v => patchModifier(group.key, mod.key, {name: v})}
                        />
                        <TextInput
                          style={[styles.modPriceInput, {borderColor: theme.border, color: theme.textPrimary}]}
                          placeholder="₹0"
                          placeholderTextColor={theme.textMuted}
                          value={mod.price}
                          onChangeText={v => patchModifier(group.key, mod.key, {price: v})}
                          keyboardType="decimal-pad"
                        />
                        <TouchableOpacity
                          onPress={() => removeModifier(group.key, mod.key)}
                          style={styles.removeBtn}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.addModBtn, {borderColor: theme.border}]}
                  onPress={() => addModifier(group.key)}>
                  <Text style={[styles.addModBtnText, {color: theme.textSecondary}]}>+ Add option</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addGroupBtn, {borderColor: theme.primary}]}
              onPress={addGroup}>
              <Text style={[styles.addGroupBtnText, {color: theme.primary}]}>+ Add modifier group</Text>
            </TouchableOpacity>

          </ScrollView>

          {/* Submit */}
          <View style={[styles.modalFooter, {backgroundColor: theme.surface, borderTopColor: theme.border}]}>
            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={handleAdd}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Add item</Text>}
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  toolbar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
  },
  addItemBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addItemBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},

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

  // Modal
  modalRoot: {flex: 1},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {fontSize: 17, fontWeight: '700'},
  modalClose: {fontSize: 18, paddingHorizontal: 4},

  modalBody: {padding: 16, paddingBottom: 8},

  sectionLabel: {fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5},

  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  groupCard: {marginBottom: 12},

  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
  },

  // Group
  groupHeaderRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  groupNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  groupOptsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  groupOptItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  optLabel: {fontSize: 13},
  maxInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    width: 48,
    textAlign: 'center',
  },

  // Modifiers
  modifierList: {marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 6},
  modifierRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  modNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  modPriceInput: {
    width: 70,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'right',
  },
  removeBtn: {padding: 6},
  removeBtnText: {fontSize: 14, color: '#ef4444'},

  addModBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addModBtnText: {fontSize: 13, fontWeight: '600'},

  addGroupBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 16,
  },
  addGroupBtnText: {fontSize: 14, fontWeight: '700'},

  // Footer
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: {opacity: 0.6},
  submitBtnText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
