import React, {useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {createCombo, deleteCombo} from '@/src/api/inventory';
import type Combo from '@/src/db/models/Combo';

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ScreenProps {
  combos: Combo[];
}

function InventoryCombosScreen({combos}: ScreenProps) {
  const theme = useTheme();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const visible = combos.filter(c => c.syncState !== 'deleted' && c.isActive);

  function handleDelete(combo: Combo) {
    Alert.alert('Delete Combo', `Remove combo "${combo.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await combo.update((r: any) => {
              r._raw.sync_state = 'pending';
              r._raw.is_active = false;
            });
          });
          if (combo.serverId && !combo.serverId.startsWith('local_')) {
            deleteCombo(combo.serverId).catch(() => {});
          }
        },
      },
    ]);
  }

  async function handleCreate() {
    if (!newName.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Validation', 'Enter a valid price');
      return;
    }

    await database.write(async () => {
      await database.get<Combo>('combos').create((r: any) => {
        r._raw.server_id = generateLocalId();
        r._raw.name = newName.trim();
        r._raw.price = price;
        r._raw.is_active = true;
        r._raw.sync_state = 'pending';
      });
    });

    createCombo({name: newName.trim(), price, is_active: true}).catch(() => {});

    setNewName('');
    setNewPrice('');
    setShowNew(false);
  }

  function resetModal() {
    setNewName('');
    setNewPrice('');
    setShowNew(false);
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
          style={styles.addBtn}
          onPress={() => setShowNew(true)}>
          <Text style={styles.addBtnText}>+ Combo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visible}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            No combos yet.
          </Text>
        }
        renderItem={({item: combo}) => (
          <View
            style={[
              styles.comboRow,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            <View style={styles.comboInfo}>
              <Text style={[styles.comboName, {color: theme.textPrimary}]}>
                {combo.name}
              </Text>
              <Text style={[styles.comboPrice, {color: theme.textSecondary}]}>
                ₹{combo.price.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(combo)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* New Combo Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, {backgroundColor: theme.surface}]}>
            <Text style={[styles.modalTitle, {color: theme.textPrimary}]}>
              New Combo
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
              value={newName}
              onChangeText={setNewName}
              placeholder="Combo name *"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.surfaceAlt,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="Price (₹) *"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, {borderColor: theme.border}]}
                onPress={resetModal}>
                <Text style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreate}>
                <Text style={styles.confirmBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const enhance = withObservables([], () => ({
  combos: database
    .get<Combo>('combos')
    .query(Q.sortBy('name', Q.asc)),
}));

export default enhance(InventoryCombosScreen as any) as any;

const styles = StyleSheet.create({
  screen: {flex: 1},
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  addBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  list: {padding: 12, paddingBottom: 32, gap: 8},
  empty: {textAlign: 'center', marginTop: 48, fontSize: 14},
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  comboInfo: {flex: 1},
  comboName: {fontSize: 14, fontWeight: '600'},
  comboPrice: {fontSize: 12, marginTop: 2},
  deleteText: {color: '#dc2626', fontSize: 13, paddingHorizontal: 4},
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {fontSize: 17, fontWeight: '700', marginBottom: 16},
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    minHeight: 44,
  },
  modalBtns: {flexDirection: 'row', gap: 12, marginTop: 4},
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  cancelBtnText: {fontWeight: '600', fontSize: 14},
  confirmBtn: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
});
