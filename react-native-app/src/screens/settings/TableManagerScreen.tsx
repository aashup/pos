import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
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
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';

import {useTheme} from '@/src/store/themeStore';
import {
  floorPlansApi,
  diningTablesApi,
  RemoteFloorPlan,
  RemoteDiningTable,
} from '@/src/api/tables';


type ViewState = 'root' | 'floor';
type Tab = 'tables' | 'floors';

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TableManagerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [viewState, setViewState] = useState<ViewState>('root');
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const [floors, setFloors] = useState<RemoteFloorPlan[]>([]);
  const [tables, setTables] = useState<RemoteDiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  const [floorModal, setFloorModal] = useState<{
    visible: boolean;
    floor?: RemoteFloorPlan;
  }>({visible: false});
  const [tableModal, setTableModal] = useState<{
    visible: boolean;
    table?: RemoteDiningTable;
  }>({visible: false});
  const [bulkModal, setBulkModal] = useState(false);

  const selectedFloor = floors.find(f => f.id === selectedFloorId) ?? null;
  const floorTables = tables.filter(t => t.floor_plan_id === selectedFloorId);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([floorPlansApi.list(), diningTablesApi.list()]);
      setFloors(f);
      setTables(t);
    } catch {
      Alert.alert('Error', 'Failed to load tables. Check server connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openFloor(floor: RemoteFloorPlan) {
    setSelectedFloorId(floor.id);
    setViewState('floor');
  }

  function handleFloorMenu(floor: RemoteFloorPlan) {
    Alert.alert(floor.name, undefined, [
      {text: 'Edit Name', onPress: () => setFloorModal({visible: true, floor})},
      {
        text: 'Delete Floor',
        style: 'destructive',
        onPress: () => confirmDeleteFloor(floor),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  }

  function confirmDeleteFloor(floor: RemoteFloorPlan) {
    Alert.alert(
      `Delete "${floor.name}"?`,
      'All tables on this floor will also be removed.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await floorPlansApi.delete(floor.id);
              if (selectedFloorId === floor.id) {
                setViewState('root');
                setSelectedFloorId(null);
              }
              reload();
            } catch (err: any) {
              Alert.alert(
                'Cannot delete',
                err?.response?.data?.message ?? 'Server error',
              );
            }
          },
        },
      ],
    );
  }

  function confirmDeleteTable(table: RemoteDiningTable) {
    Alert.alert(`Delete table "${table.name}"?`, undefined, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await diningTablesApi.delete(table.id);
            reload();
          } catch (err: any) {
            Alert.alert(
              'Cannot delete',
              err?.response?.data?.message ?? 'Server error',
            );
          }
        },
      },
    ]);
  }

  // ── Floor detail view ────────────────────────────────────────────────────────

  if (viewState === 'floor' && selectedFloor) {
    return (
      <SafeAreaView
        style={[styles.screen, {backgroundColor: theme.bg}]}
        edges={['top', 'left', 'right']}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {backgroundColor: theme.surface, borderBottomColor: theme.border},
          ]}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => setViewState('root')}>
            <Text style={[styles.headerBackArrow, {color: theme.textPrimary}]}>
              ←
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, {color: theme.textPrimary}]}
            numberOfLines={1}>
            {selectedFloor.name}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() =>
                setFloorModal({visible: true, floor: selectedFloor})
              }>
              <Text style={[styles.headerIcon, {color: theme.textPrimary}]}>
                ✏
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => handleFloorMenu(selectedFloor)}>
              <Text style={[styles.headerDots, {color: theme.textPrimary}]}>
                •••
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Table grid */}
        <FlatList
          data={floorTables}
          keyExtractor={t => t.id}
          numColumns={3}
          contentContainerStyle={
            floorTables.length === 0 ? styles.floorGridEmpty : styles.floorGrid
          }
          columnWrapperStyle={
            floorTables.length > 0 ? styles.floorGridRow : undefined
          }
          renderItem={({item: table}) => (
            <FloorTableCard
              table={table}
              theme={theme}
              onPress={() => setTableModal({visible: true, table})}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyBig, {color: theme.textMuted}]}>
                🪑
              </Text>
              <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
                No tables on this floor.{'\n'}Tap "Add Table" to create one.
              </Text>
            </View>
          }
        />

        {/* Footer buttons */}
        <View
          style={[
            styles.floorFooter,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
            },
          ]}>
          <TouchableOpacity
            style={[styles.bulkOutlineBtn, {borderColor: theme.primary}]}
            onPress={() => setBulkModal(true)}>
            <Text style={[styles.bulkOutlineBtnText, {color: theme.primary}]}>
              ⚡ Bulk
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addTablePill, {backgroundColor: theme.primary}]}
            onPress={() => setTableModal({visible: true})}>
            <Text style={styles.addTablePillText}>+ Add Table</Text>
          </TouchableOpacity>
        </View>

        {/* Modals */}
        {tableModal.visible && (
          <TableModal
            table={tableModal.table}
            floorPlanId={selectedFloor.id}
            theme={theme}
            onClose={() => setTableModal({visible: false})}
            onSaved={() => {
              setTableModal({visible: false});
              reload();
            }}
            onDelete={
              tableModal.table
                ? () => {
                    const t = tableModal.table!;
                    setTableModal({visible: false});
                    confirmDeleteTable(t);
                  }
                : undefined
            }
          />
        )}
        {bulkModal && (
          <BulkCreateModal
            floorPlanId={selectedFloor.id}
            theme={theme}
            onClose={() => setBulkModal(false)}
            onSaved={() => {
              setBulkModal(false);
              reload();
            }}
          />
        )}
        {floorModal.visible && (
          <FloorPlanModal
            floor={floorModal.floor}
            theme={theme}
            onClose={() => setFloorModal({visible: false})}
            onSaved={() => {
              setFloorModal({visible: false});
              reload();
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Root view ────────────────────────────────────────────────────────────────

  const tableSections = floors
    .map(floor => ({
      floor,
      data: tables.filter(t => t.floor_plan_id === floor.id),
    }))
    .filter(s => s.data.length > 0);

  const orphanTables = tables.filter(
    t => !floors.some(f => f.id === t.floor_plan_id),
  );
  if (orphanTables.length > 0) {
    tableSections.push({
      floor: {id: '__other__', name: 'Other Tables'} as RemoteFloorPlan,
      data: orphanTables,
    });
  }

  return (
    <SafeAreaView
      style={[styles.screen, {backgroundColor: theme.bg}]}
      edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: theme.surface, borderBottomColor: theme.border},
        ]}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}>
          <Text style={[styles.headerBackArrow, {color: theme.textPrimary}]}>
            ←
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.textPrimary}]}>
          Table & Floor
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab bar */}
      <View
        style={[
          styles.tabBar,
          {backgroundColor: theme.surface, borderBottomColor: theme.border},
        ]}>
        {(['tables', 'floors'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const label =
            tab === 'tables'
              ? `Table (${tables.length})`
              : `Floor (${floors.length})`;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab)}>
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? theme.primary : theme.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}>
                {label}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.tabIndicator,
                    {backgroundColor: theme.primary},
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : activeTab === 'tables' ? (
        tableSections.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyBig, {color: theme.textMuted}]}>🪑</Text>
            <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
              No tables yet.{'\n'}Add a floor first, then create tables.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.tableTabContent}>
            {tableSections.map(section => (
              <View key={section.floor.id}>
                <Text
                  style={[
                    styles.sectionHeader,
                    {color: theme.textSecondary},
                  ]}>
                  {section.floor.name}
                </Text>
                <View style={styles.tableGrid}>
                  {section.data.map(table => (
                    <RootTableCard
                      key={table.id}
                      table={table}
                      theme={theme}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )
      ) : floors.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyBig, {color: theme.textMuted}]}>🏢</Text>
          <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
            No floor plans yet.{'\n'}Tap + to add one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={floors}
          keyExtractor={f => f.id}
          contentContainerStyle={styles.floorListContent}
          renderItem={({item: floor}) => (
            <TouchableOpacity
              style={[
                styles.floorListRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => openFloor(floor)}>
              <View style={styles.floorListInfo}>
                <Text
                  style={[styles.floorListName, {color: theme.textPrimary}]}>
                  {floor.name}
                </Text>
                <Text
                  style={[
                    styles.floorListCount,
                    {color: theme.textSecondary},
                  ]}>
                  {tables.filter(t => t.floor_plan_id === floor.id).length}{' '}
                  tables
                </Text>
              </View>
              <Text style={[styles.floorListChevron, {color: theme.textMuted}]}>
                ›
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: theme.primary}]}
        onPress={() => setFloorModal({visible: true})}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Floor modal */}
      {floorModal.visible && (
        <FloorPlanModal
          floor={floorModal.floor}
          theme={theme}
          onClose={() => setFloorModal({visible: false})}
          onSaved={() => {
            setFloorModal({visible: false});
            reload();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloorTableCard — tappable, used inside floor detail
// ─────────────────────────────────────────────────────────────────────────────

function FloorTableCard({
  table,
  theme,
  onPress,
}: {
  table: RemoteDiningTable;
  theme: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tableCard,
        {backgroundColor: theme.surface, borderColor: theme.border},
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.tableCardName, {color: theme.textPrimary}]}>
        {table.name}
      </Text>
      <Text style={[styles.tableCardMeta, {color: theme.textSecondary}]}>
        {table.capacity} Seaters
      </Text>
      {!table.is_active && (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>Inactive</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootTableCard — display only, used in Table tab
// ─────────────────────────────────────────────────────────────────────────────

function RootTableCard({
  table,
  theme,
}: {
  table: RemoteDiningTable;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.tableCard,
        {backgroundColor: theme.surface, borderColor: theme.border},
      ]}>
      <Text style={[styles.tableCardName, {color: theme.textPrimary}]}>
        {table.name}
      </Text>
      <Text style={[styles.tableCardMeta, {color: theme.textSecondary}]}>
        {table.capacity} Seaters
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor plan modal
// ─────────────────────────────────────────────────────────────────────────────

function FloorPlanModal({
  floor,
  theme,
  onClose,
  onSaved,
}: {
  floor?: RemoteFloorPlan;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(floor?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (floor) {
        await floorPlansApi.update(floor.id, {name: name.trim()});
      } else {
        await floorPlansApi.create({name: name.trim()});
      }
      onSaved();
    } catch (err: any) {
      Alert.alert(
        'Failed to save',
        err?.response?.data?.message ?? 'Server error',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      title={floor ? 'Edit Floor Plan' : 'New Floor Plan'}
      theme={theme}
      onClose={onClose}>
      <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
        Name
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.bg,
            borderColor: theme.border,
            color: theme.textPrimary,
          },
        ]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ground Floor"
        placeholderTextColor={theme.textMuted}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveBtn,
            {backgroundColor: theme.primary},
            (!name.trim() || saving) && {opacity: 0.5},
          ]}
          disabled={!name.trim() || saving}
          onPress={handleSave}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              {floor ? 'Update' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table modal
// ─────────────────────────────────────────────────────────────────────────────

function TableModal({
  table,
  floorPlanId,
  theme,
  onClose,
  onSaved,
  onDelete,
}: {
  table?: RemoteDiningTable;
  floorPlanId: string;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? '4'));
  const [isActive, setIsActive] = useState(table?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Required', 'Table name is required.');
      return;
    }
    setSaving(true);
    try {
      const cap = Math.max(1, parseInt(capacity, 10) || 4);
      if (table) {
        await diningTablesApi.update(table.id, {
          name: name.trim(),
          capacity: cap,
          is_active: isActive,
        });
      } else {
        await diningTablesApi.create({
          floor_plan_id: floorPlanId,
          name: name.trim(),
          capacity: cap,
        });
      }
      onSaved();
    } catch (err: any) {
      Alert.alert(
        'Failed to save',
        err?.response?.data?.message ?? 'Server error',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      title={table ? `Edit — ${table.name}` : 'Add Table'}
      theme={theme}
      onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
          Table Name *
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.textPrimary,
            },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. T1, Table 1"
          placeholderTextColor={theme.textMuted}
          autoFocus
        />

        {/* Capacity */}
        <Text
          style={[
            styles.fieldLabel,
            {color: theme.textSecondary, marginTop: 12},
          ]}>
          Capacity (seats)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.textPrimary,
            },
          ]}
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          placeholder="4"
          placeholderTextColor={theme.textMuted}
        />

        {/* Active toggle (edit only) */}
        {table && (
          <TouchableOpacity
            style={[styles.toggleRow, {marginTop: 16}]}
            onPress={() => setIsActive(v => !v)}>
            <View style={{flex: 1}}>
              <Text style={[styles.toggleLabel, {color: theme.textPrimary}]}>
                Active
              </Text>
              <Text style={[styles.toggleSub, {color: theme.textSecondary}]}>
                Inactive tables are hidden from the POS floor view
              </Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                {backgroundColor: isActive ? theme.primary : theme.border},
              ]}>
              <View
                style={[
                  styles.toggleThumb,
                  {transform: [{translateX: isActive ? 20 : 2}]},
                ]}
              />
            </View>
          </TouchableOpacity>
        )}

        <View style={[styles.modalActions, {marginTop: 20}]}>
          {onDelete && (
            <TouchableOpacity
              style={[styles.deleteBtn]}
              onPress={onDelete}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {backgroundColor: theme.primary},
              (!name.trim() || saving) && {opacity: 0.5},
            ]}
            disabled={!name.trim() || saving}
            onPress={handleSave}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {table ? 'Update' : 'Add Table'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ModalSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulkCreateModal
// ─────────────────────────────────────────────────────────────────────────────

function BulkCreateModal({
  floorPlanId,
  theme,
  onClose,
  onSaved,
}: {
  floorPlanId: string;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prefix, setPrefix] = useState('T');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [capacity, setCapacity] = useState('4');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const fromN = Math.max(1, parseInt(from, 10) || 1);
  const toN = Math.max(fromN, parseInt(to, 10) || fromN);
  const count = toN - fromN + 1;

  const preview = Array.from({length: Math.min(count, 5)}, (_, i) => {
    return `${prefix.trim()}${fromN + i}`;
  });
  if (count > 5) preview.push(`… (${count} total)`);

  async function handleCreate() {
    if (!prefix.trim()) {
      Alert.alert('Required', 'Enter a prefix (e.g. T, Table )');
      return;
    }
    if (count < 1 || count > 100) {
      Alert.alert('Invalid range', 'Range must be between 1 and 100 tables.');
      return;
    }
    setSaving(true);
    setProgress(0);
    const cap = Math.max(1, parseInt(capacity, 10) || 4);
    let created = 0;
    try {
      for (let n = fromN; n <= toN; n++) {
        await diningTablesApi.create({
          floor_plan_id: floorPlanId,
          name: `${prefix.trim()}${n}`,
          capacity: cap,
        });
        created++;
        setProgress(created);
      }
      Alert.alert('Done', `${created} table${created !== 1 ? 's' : ''} created.`);
      onSaved();
    } catch (err: any) {
      Alert.alert(
        `Failed after ${created} tables`,
        err?.response?.data?.message ?? 'Server error',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet title="Bulk Create Tables" theme={theme} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
          Prefix
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.textPrimary,
            },
          ]}
          value={prefix}
          onChangeText={setPrefix}
          placeholder="e.g. T, Table , A"
          placeholderTextColor={theme.textMuted}
          autoFocus
          autoCapitalize="characters"
        />

        <Text
          style={[
            styles.fieldLabel,
            {color: theme.textSecondary, marginTop: 12},
          ]}>
          Number range
        </Text>
        <View style={styles.rangeRow}>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>
              From
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
              value={from}
              onChangeText={setFrom}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <Text style={[styles.rangeDash, {color: theme.textMuted}]}>—</Text>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>
              To
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
              value={to}
              onChangeText={setTo}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>
              Seats
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
              placeholder="4"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {prefix.trim().length > 0 && count > 0 && (
          <View
            style={[
              styles.previewBox,
              {backgroundColor: theme.bg, borderColor: theme.border},
            ]}>
            <Text
              style={[styles.previewLabel, {color: theme.textSecondary}]}>
              Preview — {count} table{count !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.previewNames, {color: theme.textPrimary}]}>
              {preview.join('  ·  ')}
            </Text>
          </View>
        )}

        {saving && (
          <View
            style={[styles.progressWrap, {backgroundColor: theme.border}]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.round((progress / count) * 100)}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
            <Text
              style={[styles.progressText, {color: theme.textPrimary}]}>
              Creating {progress}/{count}…
            </Text>
          </View>
        )}

        <View style={[styles.modalActions, {marginTop: 20}]}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={saving}>
            <Text
              style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {backgroundColor: theme.primary},
              (saving || count < 1) && {opacity: 0.5},
            ]}
            disabled={saving || count < 1}
            onPress={handleCreate}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                Create {count} Table{count !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ModalSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModalSheet
// ─────────────────────────────────────────────────────────────────────────────

function ModalSheet({
  title,
  theme,
  children,
  onClose,
}: {
  title: string;
  theme: any;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={[styles.sheetHandle, {backgroundColor: theme.border}]} />
          <View style={[styles.sheetTitleRow, {borderColor: theme.border}]}>
            <Text style={[styles.sheetTitle, {color: theme.textPrimary}]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, {color: theme.textMuted}]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sheetBody}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {flex: 1},
  flex: {flex: 1},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackArrow: {fontSize: 22, fontWeight: '600'},
  headerTitle: {flex: 1, fontSize: 17, fontWeight: '700'},
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {fontSize: 16},
  headerDots: {fontSize: 12, letterSpacing: 1},

  // tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabText: {fontSize: 14},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },

  // tables tab
  tableTabContent: {paddingBottom: 100},
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 0.2,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },

  // floors tab
  floorListContent: {padding: 12, gap: 10},
  floorListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  floorListInfo: {flex: 1},
  floorListName: {fontSize: 15, fontWeight: '600'},
  floorListCount: {fontSize: 12, marginTop: 2},
  floorListChevron: {fontSize: 22, fontWeight: '300'},

  // table cards (shared by both root and floor detail)
  tableCard: {
    width: '30.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    justifyContent: 'center',
  },
  tableCardName: {fontSize: 16, fontWeight: '700', marginBottom: 4},
  tableCardMeta: {fontSize: 12},
  inactiveBadge: {
    marginTop: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  inactiveBadgeText: {fontSize: 10, color: '#64748b', fontWeight: '600'},

  // floor detail grid
  floorGrid: {padding: 12, gap: 10},
  floorGridEmpty: {flex: 1},
  floorGridRow: {gap: 10},

  // floor detail footer
  floorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  bulkOutlineBtn: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bulkOutlineBtnText: {fontSize: 13, fontWeight: '700'},
  addTablePill: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addTablePillText: {color: '#fff', fontSize: 15, fontWeight: '700'},

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  fabIcon: {color: '#fff', fontSize: 28, fontWeight: '400', lineHeight: 32},

  // empty
  emptyBig: {fontSize: 48, marginBottom: 8},
  emptyHint: {fontSize: 13, textAlign: 'center', lineHeight: 20},

  // modal sheet
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetTitle: {fontSize: 16, fontWeight: '700'},
  closeBtn: {padding: 6},
  closeBtnText: {fontSize: 18},
  sheetBody: {paddingHorizontal: 16, paddingTop: 16},

  // form elements
  fieldLabel: {fontSize: 12, fontWeight: '600', marginBottom: 6},
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  toggleRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  toggleLabel: {fontSize: 14, fontWeight: '600'},
  toggleSub: {fontSize: 12, marginTop: 2},
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  // range row (bulk modal)
  rangeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  rangeField: {flex: 1},
  rangeLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  rangeDash: {fontSize: 18, paddingBottom: 10},

  previewBox: {
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  previewLabel: {fontSize: 11, fontWeight: '700', marginBottom: 4},
  previewNames: {fontSize: 13, lineHeight: 20},

  progressWrap: {
    marginTop: 12,
    borderRadius: 6,
    overflow: 'hidden',
    height: 22,
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    zIndex: 1,
  },

  // modal buttons
  modalActions: {flexDirection: 'row', gap: 8, marginTop: 16},
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {fontSize: 14, fontWeight: '600'},
  saveBtn: {
    flex: 2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {color: '#dc2626', fontSize: 14, fontWeight: '700'},
});
