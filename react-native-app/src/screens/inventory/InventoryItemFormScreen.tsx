import React, {useState, useEffect} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  RouteProp,
} from '@react-navigation/native-stack';
import {Q} from '@nozbe/watermelondb';
import {database, unitsCollection, itemGroupsCollection, itemVariantsCollection} from '@/src/db';
import {useTheme} from '@/src/store/themeStore';
import {itemsApi} from '@/src/api/items';
import {itemVariantsApi} from '@/src/api/itemVariants';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import type Item from '@/src/db/models/Item';
import type ItemVariant from '@/src/db/models/ItemVariant';
import type {RootStackParamList} from '@/src/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'InventoryItemForm'>;

const FALLBACK_UNITS = ['PCS', 'KG', 'G', 'L', 'ML', 'BOX', 'STRIP', 'DOZEN', 'SET', 'PLATE', 'BOTTLE'];

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type UnitOption = {value: string; label: string};
type GroupOption = {id: string; name: string};

export default function InventoryItemFormScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const theme = useTheme();
  const {id} = route.params;
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [cgstPct, setCgstPct] = useState('2.5');
  const [sgstPct, setSgstPct] = useState('2.5');
  const [isActive, setIsActive] = useState(true);
  const [itemGroupId, setItemGroupId] = useState<string | null>(null);
  const [itemGroupName, setItemGroupName] = useState('');

  // Pickers
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Remote options
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Item & variants
  const [localItem, setLocalItem] = useState<Item | null>(null);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);

  // Load units and groups from local WatermelonDB — works fully offline
  useEffect(() => {
    (async () => {
      const [localUnits, localGroups] = await Promise.all([
        unitsCollection.query(Q.where('status', 'active')).fetch(),
        itemGroupsCollection.query().fetch(),
      ]);

      setUnits(
        localUnits.length > 0
          ? localUnits.map(u => ({value: u.value, label: `${u.value} — ${u.label}`}))
          : FALLBACK_UNITS.map(v => ({value: v, label: v})),
      );
      setGroups(localGroups.map(g => ({id: g.serverId ?? g.id, name: g.name})));
    })();
  }, []);

  // Load existing item data when editing
  useEffect(() => {
    if (isNew) return;
    (async () => {
      const item = await database.get<Item>('items').find(id);
      setLocalItem(item);
      setName(item.name);
      setPrice(String(item.price));
      setUnit(item.unit ?? 'PCS');
      setCgstPct(item.cgstPct != null ? String(item.cgstPct) : '0');
      setSgstPct(item.sgstPct != null ? String(item.sgstPct) : '0');
      setIsActive(item.isActive ?? true);
      if (item.itemGroupServerId) {
        setItemGroupId(item.itemGroupServerId);
        // Resolve group name from local DB
        const localGroups = await itemGroupsCollection.query().fetch();
        const g = localGroups.find(lg => lg.serverId === item.itemGroupServerId);
        if (g) setItemGroupName(g.name);
      }
      await refreshVariants(item);
      setLoading(false);
    })();
  }, [id]);

  async function refreshVariants(item: Item) {
    if (!item.serverId) return;
    const vs = await database
      .get<ItemVariant>('item_variants')
      .query(
        Q.where('item_server_id', item.serverId),
        Q.where('sync_state', Q.notEq('deleted')),
        Q.where('is_active', true),
      )
      .fetch();
    setVariants(vs);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Validation', 'Enter a valid price');
      return;
    }
    setSaving(true);
    try {
      const cgst = cgstPct ? parseFloat(cgstPct) : 0;
      const sgst = sgstPct ? parseFloat(sgstPct) : 0;
      const payload = {
        name: name.trim(),
        price: priceNum,
        unit,
        cgst_pct: cgst,
        sgst_pct: sgst,
        is_active: isActive,
        item_group_id: itemGroupId ?? undefined,
      };

      if (isNew) {
        // Write locally — sync engine pushes when online
        await database.write(async () => {
          await database.get<Item>('items').create((r: any) => {
            r._raw.server_id = generateLocalId();
            r._raw.name = name.trim();
            r._raw.price = priceNum;
            r._raw.unit = unit;
            r._raw.cgst_pct = cgst;
            r._raw.sgst_pct = sgst;
            r._raw.is_active = isActive;
            r._raw.has_variants = false;
            r._raw.has_modifiers = false;
            r._raw.sync_state = 'pending';
            if (itemGroupId) r._raw.item_group_server_id = itemGroupId;
          });
        });
      } else if (localItem) {
        await database.write(async () => {
          await localItem.update((r: any) => {
            r._raw.name = name.trim();
            r._raw.price = priceNum;
            r._raw.unit = unit;
            r._raw.cgst_pct = cgst;
            r._raw.sgst_pct = sgst;
            r._raw.is_active = isActive;
            r._raw.sync_state = 'pending';
            r._raw.item_group_server_id = itemGroupId ?? null;
          });
        });
        // Fire-and-forget for immediate push if item already has a real server ID
        if (localItem.serverId && !localItem.serverId.startsWith('local_')) {
          itemsApi.update(localItem.serverId, payload)
            .then(async () => {
              await database.write(async () => {
                await localItem.update((r: any) => {r._raw.sync_state = 'synced';});
              });
            })
            .catch(() => {}); // pushPendingItems will retry
        }
      }
      triggerSyncNow();
      nav.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant() {
    if (!localItem) return;
    if (!newVariantName.trim()) return;
    const variantPrice = parseFloat(newVariantPrice);
    if (isNaN(variantPrice)) {
      Alert.alert('Validation', 'Enter a valid variant price');
      return;
    }
    setSavingVariant(true);
    try {
      await database.write(async () => {
        await database.get<ItemVariant>('item_variants').create((r: any) => {
          r._raw.server_id = generateLocalId();
          r._raw.item_server_id = localItem.serverId ?? localItem.id;
          r._raw.name = newVariantName.trim();
          r._raw.price = variantPrice;
          r._raw.is_active = true;
          r._raw.sync_state = 'pending';
        });
        await localItem.update((r: any) => {r._raw.has_variants = true;});
      });
      triggerSyncNow();
      setNewVariantName('');
      setNewVariantPrice('');
      await refreshVariants(localItem);
    } finally {
      setSavingVariant(false);
    }
  }

  async function handleDeleteVariant(variant: ItemVariant) {
    await database.write(async () => {
      await variant.update((r: any) => {
        r._raw.sync_state = 'deleted';
        r._raw.is_active = false;
      });
    });
    triggerSyncNow();
    setVariants(prev => prev.filter(v => v.id !== variant.id));
  }

  const filteredUnits = units.filter(u =>
    u.label.toLowerCase().includes(unitSearch.toLowerCase()),
  );
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={[styles.center, {backgroundColor: theme.bg}]}>
        <ActivityIndicator size="large" color="#d97706" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Action bar */}
      <View style={[styles.actionBar, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        <Text style={[styles.actionTitle, {color: theme.textPrimary}]}>
          {isNew ? 'New Item' : 'Edit Item'}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Item Details ── */}
        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Item Details</Text>

          {/* Name */}
          <View style={[styles.field, {borderBottomWidth: 1, borderBottomColor: theme.borderLight}]}>
            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>Name *</Text>
            <TextInput
              style={[styles.fieldInput, {color: theme.textPrimary}]}
              value={name}
              onChangeText={setName}
              placeholder="Item name"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {/* Unit + Item Group row */}
          <View style={styles.halfRow}>
            <View style={[styles.halfField, {borderRightWidth: 1, borderRightColor: theme.borderLight}]}>
              <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>Unit *</Text>
              <TouchableOpacity onPress={() => setUnitPickerOpen(true)} style={styles.pickerBtn}>
                <Text style={[styles.pickerBtnText, {color: theme.textPrimary}]}>{unit || 'Select…'}</Text>
                <Text style={[styles.pickerArrow, {color: theme.textMuted}]}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>Item Group</Text>
              <TouchableOpacity onPress={() => setGroupPickerOpen(true)} style={styles.pickerBtn}>
                <Text
                  style={[styles.pickerBtnText, {color: itemGroupName ? theme.textPrimary : theme.textMuted}]}
                  numberOfLines={1}>
                  {itemGroupName || 'None'}
                </Text>
                <Text style={[styles.pickerArrow, {color: theme.textMuted}]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Price */}
          <View style={[styles.field, {borderTopWidth: 1, borderTopColor: theme.borderLight}]}>
            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>Selling Price (₹) *</Text>
            <TextInput
              style={[styles.fieldInput, {color: theme.textPrimary}]}
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Active toggle */}
          <View style={[styles.toggleRow, {borderTopWidth: 1, borderTopColor: theme.borderLight}]}>
            <Text style={[styles.toggleLabel, {color: theme.textPrimary}]}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{false: theme.surfaceAlt, true: '#d97706'}}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── GST ── */}
        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>GST</Text>
          <View style={styles.halfRow}>
            <View style={[styles.halfField, {borderRightWidth: 1, borderRightColor: theme.borderLight}]}>
              <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>CGST %</Text>
              <TextInput
                style={[styles.fieldInput, {color: theme.textPrimary}]}
                value={cgstPct}
                onChangeText={setCgstPct}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>SGST %</Text>
              <TextInput
                style={[styles.fieldInput, {color: theme.textPrimary}]}
                value={sgstPct}
                onChangeText={setSgstPct}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Variants ── */}
        {!isNew && (
          <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Variants</Text>

            {variants.map((v, i) => (
              <View
                key={v.id}
                style={[
                  styles.variantRow,
                  i < variants.length - 1 && {borderBottomWidth: 1, borderBottomColor: theme.borderLight},
                ]}>
                <Text style={[styles.variantName, {color: theme.textPrimary}]}>{v.name}</Text>
                <Text style={[styles.variantPrice, {color: theme.textSecondary}]}>₹{v.price.toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteVariant(v)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={[styles.addVariantRow, {borderTopColor: theme.border, borderTopWidth: variants.length > 0 ? 1 : 0}]}>
              <TextInput
                style={[styles.variantInput, {backgroundColor: theme.surfaceAlt, color: theme.textPrimary}]}
                value={newVariantName}
                onChangeText={setNewVariantName}
                placeholder="Variant name"
                placeholderTextColor={theme.textMuted}
              />
              <TextInput
                style={[styles.variantPriceInput, {backgroundColor: theme.surfaceAlt, color: theme.textPrimary}]}
                value={newVariantPrice}
                onChangeText={setNewVariantPrice}
                placeholder="₹0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[styles.addVariantBtn, savingVariant && {opacity: 0.6}]}
                onPress={handleAddVariant}
                disabled={savingVariant}>
                <Text style={styles.addVariantBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Unit picker modal ── */}
      <Modal visible={unitPickerOpen} animationType="slide" transparent onRequestClose={() => setUnitPickerOpen(false)}>
        <View style={[styles.modalBackdrop, {backgroundColor: theme.scrim}]}>
          <View style={[styles.modalSheet, {backgroundColor: theme.surface}]}>
            <View style={[styles.modalHeader, {borderBottomColor: theme.border}]}>
              <Text style={[styles.modalTitle, {color: theme.textPrimary}]}>Select Unit</Text>
              <TouchableOpacity onPress={() => setUnitPickerOpen(false)}>
                <Text style={[styles.modalClose, {color: theme.textMuted}]}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalSearch, {backgroundColor: theme.surfaceAlt, color: theme.textPrimary, borderColor: theme.border}]}
              placeholder="Search units…"
              placeholderTextColor={theme.textMuted}
              value={unitSearch}
              onChangeText={setUnitSearch}
            />
            <FlatList
              data={filteredUnits}
              keyExtractor={u => u.value}
              renderItem={({item: u}) => (
                <TouchableOpacity
                  style={[styles.modalOption, {borderBottomColor: theme.borderLight}, unit === u.value && {backgroundColor: theme.surfaceAlt}]}
                  onPress={() => {setUnit(u.value); setUnitPickerOpen(false); setUnitSearch('');}}>
                  <Text style={[styles.modalOptionText, {color: theme.textPrimary}]}>{u.label}</Text>
                  {unit === u.value && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Item group picker modal ── */}
      <Modal visible={groupPickerOpen} animationType="slide" transparent onRequestClose={() => setGroupPickerOpen(false)}>
        <View style={[styles.modalBackdrop, {backgroundColor: theme.scrim}]}>
          <View style={[styles.modalSheet, {backgroundColor: theme.surface}]}>
            <View style={[styles.modalHeader, {borderBottomColor: theme.border}]}>
              <Text style={[styles.modalTitle, {color: theme.textPrimary}]}>Select Item Group</Text>
              <TouchableOpacity onPress={() => setGroupPickerOpen(false)}>
                <Text style={[styles.modalClose, {color: theme.textMuted}]}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalSearch, {backgroundColor: theme.surfaceAlt, color: theme.textPrimary, borderColor: theme.border}]}
              placeholder="Search groups…"
              placeholderTextColor={theme.textMuted}
              value={groupSearch}
              onChangeText={setGroupSearch}
            />
            <FlatList
              data={[{id: '', name: 'None'}, ...filteredGroups]}
              keyExtractor={g => g.id}
              renderItem={({item: g}) => (
                <TouchableOpacity
                  style={[styles.modalOption, {borderBottomColor: theme.borderLight}, itemGroupId === g.id && {backgroundColor: theme.surfaceAlt}]}
                  onPress={() => {
                    setItemGroupId(g.id || null);
                    setItemGroupName(g.id ? g.name : '');
                    setGroupPickerOpen(false);
                    setGroupSearch('');
                  }}>
                  <Text style={[styles.modalOptionText, {color: g.id ? theme.textPrimary : theme.textMuted}]}>{g.name}</Text>
                  {itemGroupId === g.id && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  actionTitle: {fontSize: 16, fontWeight: '700'},
  saveBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveBtnDisabled: {opacity: 0.6},
  saveBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  scroll: {padding: 16, paddingBottom: 48, gap: 12},
  section: {borderRadius: 12, borderWidth: 1, overflow: 'hidden'},
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  field: {paddingHorizontal: 16, paddingVertical: 12},
  fieldLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  fieldInput: {fontSize: 14, minHeight: 28},
  halfRow: {flexDirection: 'row'},
  halfField: {flex: 1, paddingHorizontal: 16, paddingVertical: 12},
  pickerBtn: {flexDirection: 'row', alignItems: 'center', minHeight: 28},
  pickerBtnText: {flex: 1, fontSize: 14},
  pickerArrow: {fontSize: 18},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  toggleLabel: {fontSize: 14, fontWeight: '500'},
  // Variants
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  variantName: {flex: 1, fontSize: 14},
  variantPrice: {fontSize: 13, marginRight: 12},
  removeText: {color: '#dc2626', fontSize: 13},
  addVariantRow: {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8},
  variantInput: {flex: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 44},
  variantPriceInput: {width: 72, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 44},
  addVariantBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addVariantBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  // Modals
  modalBackdrop: {flex: 1, justifyContent: 'flex-end'},
  modalSheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%'},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {fontSize: 16, fontWeight: '700'},
  modalClose: {fontSize: 18, paddingHorizontal: 4},
  modalSearch: {
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  modalOptionText: {flex: 1, fontSize: 14},
  checkMark: {color: '#d97706', fontSize: 16, fontWeight: '700'},
});
