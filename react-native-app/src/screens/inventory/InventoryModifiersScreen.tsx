import React, {useState} from 'react';
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
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';
import {database} from '@/src/db';
import {useTheme} from '@/src/store/themeStore';
import {
  createModifierGroup,
  deleteModifierGroup,
  createModifier,
  deleteModifier,
} from '@/src/api/inventory';
import type ModifierGroup from '@/src/db/models/ModifierGroup';
import type Modifier from '@/src/db/models/Modifier';

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── GroupCard ────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: ModifierGroup;
  modifiers: Modifier[];
}

function GroupCard({group, modifiers}: GroupCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');

  const visible = modifiers.filter(
    m => m.syncState !== 'deleted' && m.isActive,
  );

  async function handleAddModifier() {
    if (!addName.trim()) {
      return;
    }
    const price = parseFloat(addPrice) || 0;
    const localId = generateLocalId();

    await database.write(async () => {
      await database.get<Modifier>('modifiers').create((r: any) => {
        r._raw.server_id = localId;
        r._raw.modifier_group_server_id = group.serverId ?? localId;
        r._raw.name = addName.trim();
        r._raw.price = price;
        r._raw.sort_order = modifiers.length;
        r._raw.is_active = true;
        r._raw.sync_state = 'pending';
      });
    });

    if (group.serverId && !group.serverId.startsWith('local_')) {
      createModifier({
        modifier_group_id: group.serverId,
        name: addName.trim(),
        price,
      }).catch(() => {});
    }

    setAddName('');
    setAddPrice('');
  }

  async function handleDeleteModifier(mod: Modifier) {
    await database.write(async () => {
      await mod.update((r: any) => {
        r._raw.sync_state = 'deleted';
        r._raw.is_active = false;
      });
    });
    if (
      mod.serverId &&
      !mod.serverId.startsWith('local_') &&
      group.serverId &&
      !group.serverId.startsWith('local_')
    ) {
      deleteModifier(group.serverId, mod.serverId).catch(() => {});
    }
  }

  async function handleDeleteGroup() {
    Alert.alert(
      'Delete Group',
      `Remove "${group.name}" and all its modifiers?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await database.write(async () => {
              await group.update((r: any) => {
                r._raw.sync_state = 'deleted';
              });
              for (const mod of modifiers) {
                await mod.update((r: any) => {
                  r._raw.sync_state = 'deleted';
                  r._raw.is_active = false;
                });
              }
            });
            if (group.serverId && !group.serverId.startsWith('local_')) {
              deleteModifierGroup(group.serverId).catch(() => {});
            }
          },
        },
      ],
    );
  }

  return (
    <View
      style={[
        styles.groupCard,
        {backgroundColor: theme.surface, borderColor: theme.border},
      ]}>
      {/* Header */}
      <TouchableOpacity
        style={[styles.groupHeader, {borderBottomColor: theme.border}]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}>
        <View style={styles.groupHeaderText}>
          <Text style={[styles.groupName, {color: theme.textPrimary}]}>
            {group.name}
          </Text>
          <Text style={[styles.groupMeta, {color: theme.textSecondary}]}>
            {group.isRequired ? 'Required' : 'Optional'} · max{' '}
            {group.maxSelections} · {visible.length} options
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleDeleteGroup}
          style={styles.deleteGroupBtn}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
        <Text style={[styles.chevron, {color: theme.textMuted}]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <>
          {visible.map((mod, i) => (
            <View
              key={mod.id}
              style={[
                styles.modRow,
                i < visible.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderLight,
                },
              ]}>
              <Text style={[styles.modName, {color: theme.textPrimary}]}>
                {mod.name}
              </Text>
              <Text style={[styles.modPrice, {color: theme.textSecondary}]}>
                +₹{mod.price.toFixed(2)}
              </Text>
              <TouchableOpacity
                onPress={() => handleDeleteModifier(mod)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add modifier row */}
          <View
            style={[
              styles.addModRow,
              {borderTopColor: theme.border, borderTopWidth: 1},
            ]}>
            <TextInput
              style={[
                styles.addModInput,
                {backgroundColor: theme.surfaceAlt, color: theme.textPrimary},
              ]}
              value={addName}
              onChangeText={setAddName}
              placeholder="Option name"
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={[
                styles.addModPrice,
                {backgroundColor: theme.surfaceAlt, color: theme.textPrimary},
              ]}
              value={addPrice}
              onChangeText={setAddPrice}
              placeholder="+₹0"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.addModBtn}
              onPress={handleAddModifier}>
              <Text style={styles.addModBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const EnhancedGroupCard = withObservables(
  ['group'],
  ({group}: {group: ModifierGroup}) => ({
    group,
    modifiers: database
      .get<Modifier>('modifiers')
      .query(Q.where('modifier_group_server_id', group.serverId ?? '')),
  }),
)(GroupCard as any) as any;

// ── Main Screen ──────────────────────────────────────────────────────────────

interface ScreenProps {
  groups: ModifierGroup[];
}

function InventoryModifiersScreen({groups}: ScreenProps) {
  const theme = useTheme();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMax, setNewGroupMax] = useState('3');

  const visible = groups.filter(g => g.syncState !== 'deleted');

  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      return;
    }
    const max = parseInt(newGroupMax, 10) || 1;
    const localId = generateLocalId();

    await database.write(async () => {
      await database.get<ModifierGroup>('modifier_groups').create((r: any) => {
        r._raw.server_id = localId;
        r._raw.name = newGroupName.trim();
        r._raw.is_required = newGroupRequired;
        r._raw.min_selections = newGroupRequired ? 1 : 0;
        r._raw.max_selections = max;
        r._raw.sync_state = 'pending';
      });
    });

    createModifierGroup({
      name: newGroupName.trim(),
      is_required: newGroupRequired,
      min_selections: newGroupRequired ? 1 : 0,
      max_selections: max,
    }).catch(() => {});

    setNewGroupName('');
    setNewGroupRequired(false);
    setNewGroupMax('3');
    setShowNewGroup(false);
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          {backgroundColor: theme.surface, borderColor: theme.border},
        ]}>
        <TouchableOpacity
          style={styles.addGroupBtn}
          onPress={() => setShowNewGroup(true)}>
          <Text style={styles.addGroupBtnText}>+ Group</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visible}
        keyExtractor={g => g.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            No modifier groups yet.
          </Text>
        }
        renderItem={({item}) => <EnhancedGroupCard group={item} />}
      />

      {/* New Group Modal */}
      <Modal visible={showNewGroup} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalSheet, {backgroundColor: theme.surface}]}>
            <Text style={[styles.modalTitle, {color: theme.textPrimary}]}>
              New Modifier Group
            </Text>

            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
              Group Name *
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.surfaceAlt,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="e.g. Spice Level"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />

            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
              Max Selections
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.surfaceAlt,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              value={newGroupMax}
              onChangeText={setNewGroupMax}
              keyboardType="number-pad"
              placeholderTextColor={theme.textMuted}
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNewGroupRequired(r => !r)}>
              <View
                style={[
                  styles.checkbox,
                  {borderColor: newGroupRequired ? '#d97706' : theme.border},
                  newGroupRequired && styles.checkboxChecked,
                ]}>
                {newGroupRequired && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={[styles.checkboxLabel, {color: theme.textPrimary}]}>
                Required selection
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {borderColor: theme.border},
                ]}
                onPress={() => setShowNewGroup(false)}>
                <Text style={[styles.modalCancelText, {color: theme.textSecondary}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateGroup}>
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const enhance = withObservables([], () => ({
  groups: database
    .get<ModifierGroup>('modifier_groups')
    .query(Q.sortBy('name', Q.asc)),
}));

export default enhance(InventoryModifiersScreen as any) as any;

const styles = StyleSheet.create({
  screen: {flex: 1},
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  addGroupBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addGroupBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  list: {padding: 12, paddingBottom: 32, gap: 10},
  empty: {textAlign: 'center', marginTop: 48, fontSize: 14},
  groupCard: {borderRadius: 12, borderWidth: 1, overflow: 'hidden'},
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  groupHeaderText: {flex: 1},
  groupName: {fontSize: 14, fontWeight: '600'},
  groupMeta: {fontSize: 11, marginTop: 2},
  deleteGroupBtn: {paddingHorizontal: 8, paddingVertical: 4, minHeight: 44, justifyContent: 'center'},
  deleteText: {color: '#dc2626', fontSize: 13},
  chevron: {fontSize: 12, marginLeft: 6},
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  modName: {flex: 1, fontSize: 13},
  modPrice: {fontSize: 13, marginRight: 12},
  removeText: {color: '#dc2626', fontSize: 12},
  addModRow: {flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8},
  addModInput: {flex: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 44},
  addModPrice: {width: 72, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 44},
  addModBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addModBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  // Modal
  modalBackdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)'},
  modalSheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24},
  modalTitle: {fontSize: 17, fontWeight: '700', marginBottom: 16},
  fieldLabel: {fontSize: 11, marginBottom: 4, marginTop: 8},
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 4,
    minHeight: 44,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {backgroundColor: '#d97706', borderColor: '#d97706'},
  checkmark: {color: '#fff', fontSize: 12, fontWeight: '700'},
  checkboxLabel: {fontSize: 14},
  modalBtns: {flexDirection: 'row', gap: 12},
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  modalCancelText: {fontWeight: '600', fontSize: 14},
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  modalConfirmText: {color: '#fff', fontWeight: '700', fontSize: 14},
});
