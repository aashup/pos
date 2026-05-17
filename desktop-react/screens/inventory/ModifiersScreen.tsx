import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { withObservables } from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/db';
import {
  createModifierGroup, deleteModifierGroup,
  createModifier, deleteModifier,
} from '@/src/api/inventory';
import type ModifierGroup from '@/src/db/models/ModifierGroup';
import type Modifier from '@/src/db/models/Modifier';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface GroupProps {
  group: ModifierGroup;
  modifiers: Modifier[];
}

function GroupCard({ group, modifiers }: GroupProps) {
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [expanded, setExpanded] = useState(true);

  const handleAddModifier = async () => {
    if (!addName.trim()) return;
    const price = parseFloat(addPrice) || 0;
    const localId = generateLocalId();

    await database.write(async () => {
      await database.get<Modifier>('modifiers').create((r: any) => {
        r._raw.server_id = localId;
        r._raw.modifier_group_id = group.serverId;
        r._raw.name = addName.trim();
        r._raw.price = price;
        r._raw.sort_order = modifiers.length;
        r._raw.is_active = true;
        r._raw.sync_status = 'pending';
      });
    });

    createModifier({
      modifier_group_id: group.serverId,
      name: addName.trim(),
      price,
    }).catch(() => {});

    setAddName('');
    setAddPrice('');
  };

  const handleDeleteModifier = async (mod: Modifier) => {
    await database.write(async () => {
      await mod.update((r: any) => { r._raw.sync_status = 'deleted'; r._raw.is_active = false; });
    });
    if (mod.serverId && !mod.serverId.startsWith('local_')) {
      deleteModifier(mod.serverId).catch(() => {});
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert('Delete Group', `Remove group "${group.name}" and all its modifiers?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await database.write(async () => {
            await group.update((r: any) => { r._raw.sync_status = 'deleted'; });
            for (const mod of modifiers) {
              await mod.update((r: any) => { r._raw.sync_status = 'deleted'; r._raw.is_active = false; });
            }
          });
          if (group.serverId && !group.serverId.startsWith('local_')) {
            deleteModifierGroup(group.serverId).catch(() => {});
          }
        },
      },
    ]);
  };

  const visible = modifiers.filter((m) => m.syncStatus !== 'deleted' && m.isActive);

  return (
    <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3">
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center px-4 py-3 border-b border-gray-100"
      >
        <View className="flex-1">
          <Text className="text-gray-800 font-semibold">{group.name}</Text>
          <Text className="text-gray-400 text-xs">
            {group.isRequired ? 'Required' : 'Optional'} · max {group.maxSelections} · {visible.length} options
          </Text>
        </View>
        <TouchableOpacity onPress={handleDeleteGroup} className="px-3 py-1 mr-1">
          <Text className="text-red-400 text-sm">Delete</Text>
        </TouchableOpacity>
        <Text className="text-gray-400">{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <>
          {visible.map((mod, i) => (
            <View key={mod.id} className={`flex-row items-center px-4 py-2.5 ${i < visible.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <Text className="flex-1 text-gray-700 text-sm">{mod.name}</Text>
              <Text className="text-gray-500 text-sm mr-3">+₹{mod.price.toFixed(2)}</Text>
              <TouchableOpacity onPress={() => handleDeleteModifier(mod)}>
                <Text className="text-red-400 text-xs">Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View className="flex-row px-4 py-3 border-t border-gray-100 gap-2">
            <TextInput
              value={addName}
              onChangeText={setAddName}
              placeholder="Option name"
              className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
            <TextInput
              value={addPrice}
              onChangeText={setAddPrice}
              placeholder="+₹0"
              keyboardType="decimal-pad"
              className="w-20 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
            <TouchableOpacity
              onPress={handleAddModifier}
              className="bg-amber-500 px-3 py-2 rounded-lg justify-center"
            >
              <Text className="text-white font-semibold text-sm">Add</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const EnhancedGroupCard = withObservables(['group'], ({ group }: { group: ModifierGroup }) => ({
  group,
  modifiers: group.modifiers,
}))(GroupCard as any) as any;

interface ScreenProps {
  groups: ModifierGroup[];
}

function ModifiersScreen({ groups }: ScreenProps) {
  const navigation = useNavigation<Nav>();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMax, setNewGroupMax] = useState('3');

  const visible = groups.filter((g) => g.syncStatus !== 'deleted');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const max = parseInt(newGroupMax) || 1;
    const localId = generateLocalId();

    await database.write(async () => {
      await database.get<ModifierGroup>('modifier_groups').create((r: any) => {
        r._raw.server_id = localId;
        r._raw.name = newGroupName.trim();
        r._raw.is_required = newGroupRequired;
        r._raw.min_selections = newGroupRequired ? 1 : 0;
        r._raw.max_selections = max;
        r._raw.sync_status = 'pending';
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
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text className="text-amber-600">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Modifier Groups</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowNewGroup(true)}
          className="bg-amber-500 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-white font-semibold text-sm">+ Group</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {visible.length === 0 ? (
          <Text className="text-center text-gray-400 mt-8">No modifier groups yet.</Text>
        ) : (
          visible.map((g) => <EnhancedGroupCard key={g.id} group={g} />)
        )}
      </ScrollView>

      <Modal visible={showNewGroup} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-gray-800 mb-4">New Modifier Group</Text>

            <Text className="text-xs text-gray-400 mb-1">Group Name *</Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="e.g. Spice Level"
              className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 mb-3"
              autoFocus
            />

            <Text className="text-xs text-gray-400 mb-1">Max Selections</Text>
            <TextInput
              value={newGroupMax}
              onChangeText={setNewGroupMax}
              keyboardType="number-pad"
              className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 mb-3"
            />

            <TouchableOpacity
              onPress={() => setNewGroupRequired((r) => !r)}
              className="flex-row items-center mb-5"
            >
              <View className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${newGroupRequired ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                {newGroupRequired && <Text className="text-white text-xs font-bold">✓</Text>}
              </View>
              <Text className="text-gray-700 text-sm">Required selection</Text>
            </TouchableOpacity>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowNewGroup(false)}
                className="flex-1 border border-gray-300 py-3 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGroup}
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
  groups: database
    .get<ModifierGroup>('modifier_groups')
    .query(Q.sortBy('name', Q.asc)),
}));

export default (enhance(ModifiersScreen as any) as any);
