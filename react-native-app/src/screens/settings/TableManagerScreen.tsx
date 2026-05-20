import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
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
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';

import Icon from 'react-native-vector-icons/FontAwesome5';
import {Q} from '@nozbe/watermelondb';
import {useTheme} from '@/src/store/themeStore';
import {database, floorPlansCollection, diningTablesCollection} from '@/src/db';
import FloorPlan from '@/src/db/models/FloorPlan';
import DiningTable from '@/src/db/models/DiningTable';
import {floorPlansApi, diningTablesApi} from '@/src/api/tables';
import {triggerSyncNow} from '@/src/lib/syncEngine';

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type ViewState = 'root' | 'floor';
type Tab = 'tables' | 'floors';

const COLLAPSE_HEIGHT = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Main screen (inner — receives reactive WatermelonDB props)
// ─────────────────────────────────────────────────────────────────────────────

type Props = {floors: FloorPlan[]; tables: DiningTable[]};

function TableManagerScreenInner({floors, tables}: Props) {
  const theme = useTheme();
  const navigation = useNavigation();

  const [viewState, setViewState] = useState<ViewState>('root');
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const scrollY = useRef(new Animated.Value(0)).current;
  const [syncing, setSyncing] = useState(false);

  // WatermelonDB local id of the selected floor
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  const [floorModal, setFloorModal] = useState<{visible: boolean; floor?: FloorPlan}>({
    visible: false,
  });
  const [tableModal, setTableModal] = useState<{visible: boolean; table?: DiningTable}>({
    visible: false,
  });
  const [bulkModal, setBulkModal] = useState(false);
  const [menuSheet, setMenuSheet] = useState<{visible: boolean; floor?: FloorPlan}>({
    visible: false,
  });

  const selectedFloor = floors.find(f => f.id === selectedFloorId) ?? null;
  const floorTables = tables.filter(t => t.floorPlanServerId === selectedFloor?.serverId);

  // Trigger sync on mount so data is fresh
  useEffect(() => {
    setSyncing(true);
    triggerSyncNow();
    const t = setTimeout(() => setSyncing(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // Sync native header with internal view state
  useEffect(() => {
    if (viewState === 'floor' && selectedFloor) {
      navigation.setOptions({
        headerShown: true,
        title: selectedFloor.name,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              setViewState('root');
              setSelectedFloorId(null);
            }}
            style={{paddingHorizontal: 8, paddingVertical: 6}}>
            <Icon name="arrow-left" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <TouchableOpacity
              style={{padding: 8}}
              onPress={() => setFloorModal({visible: true, floor: selectedFloor})}>
              <Icon name="pen" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{padding: 8, marginRight: 4}}
              onPress={() => setMenuSheet({visible: true, floor: selectedFloor})}>
              <Icon name="ellipsis-v" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerShown: false,
        title: 'Table & Floor',
        headerLeft: undefined,
        headerRight: undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState, selectedFloor?.id, selectedFloor?.name, theme.textPrimary]);

  // Android hardware back
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (viewState === 'floor') {
          setViewState('root');
          setSelectedFloorId(null);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [viewState]),
  );

  function openFloor(floor: FloorPlan) {
    setSelectedFloorId(floor.id);
    setViewState('floor');
  }

  async function confirmDeleteFloor(floor: FloorPlan) {
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
              // Delete locally first — UI updates immediately
              const floorTbls = tables.filter(
                t => t.floorPlanServerId === floor.serverId,
              );
              await database.write(async () => {
                for (const t of floorTbls) {
                  await t.markAsDeleted();
                }
                await floor.markAsDeleted();
              });
              if (selectedFloorId === floor.id) {
                setViewState('root');
                setSelectedFloorId(null);
              }
              // Fire-and-forget server delete
              if (floor.serverId && !floor.serverId.startsWith('local_')) {
                floorPlansApi.delete(floor.serverId).catch(() => {});
              }
            } catch (err: any) {
              Alert.alert('Cannot delete', err?.message ?? 'Error');
            }
          },
        },
      ],
    );
  }

  async function confirmDeleteTable(table: DiningTable) {
    Alert.alert(`Delete table "${table.name}"?`, undefined, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete locally first — UI updates immediately
            await database.write(async () => {
              await table.markAsDeleted();
            });
            // Fire-and-forget server delete
            if (table.serverId && !table.serverId.startsWith('local_')) {
              diningTablesApi.delete(table.serverId).catch(() => {});
            }
          } catch (err: any) {
            Alert.alert('Cannot delete', err?.message ?? 'Error');
          }
        },
      },
    ]);
  }

  // ── Floor detail view ──────────────────────────────────────────────────────

  if (viewState === 'floor' && selectedFloor) {
    return (
      <SafeAreaView
        style={[styles.screen, {backgroundColor: theme.bg}]}
        edges={['left', 'right']}>
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
              <Text style={[styles.emptyBig, {color: theme.textMuted}]}>🪑</Text>
              <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
                No tables on this floor.{'\n'}Tap "Add Table" to create one.
              </Text>
            </View>
          }
        />

        {tableModal.visible && (
          <TableModal
            table={tableModal.table}
            floorPlan={selectedFloor}
            theme={theme}
            onClose={() => setTableModal({visible: false})}
            onSaved={() => setTableModal({visible: false})}
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
            floorPlan={selectedFloor}
            theme={theme}
            onClose={() => setBulkModal(false)}
            onSaved={() => setBulkModal(false)}
          />
        )}
        {floorModal.visible && (
          <FloorPlanModal
            floor={floorModal.floor}
            theme={theme}
            onClose={() => setFloorModal({visible: false})}
            onSaved={() => setFloorModal({visible: false})}
          />
        )}
        {menuSheet.visible && menuSheet.floor && (
          <FloorMenuSheet
            floor={menuSheet.floor}
            theme={theme}
            onClose={() => setMenuSheet({visible: false})}
            onAddTable={() => {
              setMenuSheet({visible: false});
              setTableModal({visible: true});
            }}
            onBulkTable={() => {
              setMenuSheet({visible: false});
              setBulkModal(true);
            }}
            onEdit={() => {
              setMenuSheet({visible: false});
              setFloorModal({visible: true, floor: menuSheet.floor});
            }}
            onDelete={() => {
              setMenuSheet({visible: false});
              confirmDeleteFloor(menuSheet.floor!);
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Root view ──────────────────────────────────────────────────────────────

  const tableSections = floors
    .map(floor => ({
      floor,
      data: tables.filter(t => t.floorPlanServerId === floor.serverId),
    }))
    .filter(s => s.data.length > 0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE_HEIGHT],
    outputRange: [COLLAPSE_HEIGHT, 0],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_HEIGHT / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const onScroll = Animated.event(
    [{nativeEvent: {contentOffset: {y: scrollY}}}],
    {useNativeDriver: false},
  );

  function switchTab(tab: Tab) {
    scrollY.setValue(0);
    setActiveTab(tab);
  }

  return (
    <SafeAreaView
      style={[styles.screen, {backgroundColor: theme.bg}]}
      edges={['top', 'left', 'right']}>
      {/* Collapsible header */}
      <Animated.View
        style={[
          styles.collapseHeader,
          {
            height: headerHeight,
            opacity: headerOpacity,
            backgroundColor: theme.surface,
          },
        ]}>
        <Text style={[styles.collapseTitle, {color: theme.textPrimary}]}>
          Table & Floor
        </Text>
        <Text style={[styles.collapseSub, {color: theme.textSecondary}]}>
          {floors.length} floors · {tables.length} tables
          {syncing ? '  ·  syncing…' : ''}
        </Text>
      </Animated.View>

      {/* Sticky tab bar */}
      <View
        style={[
          styles.tabBar,
          {backgroundColor: theme.surface, borderBottomColor: theme.border},
        ]}>
        {(['tables', 'floors'] as Tab[]).map(tab => {
          const isActive = activeTab === tab;
          const label =
            tab === 'tables'
              ? `Tables (${tables.length})`
              : `Floors (${floors.length})`;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => switchTab(tab)}>
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
      {activeTab === 'tables' ? (
        tableSections.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyBig, {color: theme.textMuted}]}>🪑</Text>
            <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
              No tables yet.{'\n'}Add a floor first, then create tables.
            </Text>
          </View>
        ) : (
          <Animated.ScrollView
            contentContainerStyle={styles.tableTabContent}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            {tableSections.map(section => (
              <View key={section.floor.id}>
                <Text
                  style={[styles.sectionHeader, {color: theme.textSecondary}]}>
                  {section.floor.name}
                </Text>
                <View style={styles.tableGrid}>
                  {section.data.map(table => (
                    <RootTableCard key={table.id} table={table} theme={theme} />
                  ))}
                </View>
              </View>
            ))}
          </Animated.ScrollView>
        )
      ) : floors.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyBig, {color: theme.textMuted}]}>🏢</Text>
          <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
            No floor plans yet.{'\n'}Tap + to add one.
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={floors}
          keyExtractor={(f: any) => f.id}
          contentContainerStyle={styles.floorListContent}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({item: floor}: {item: FloorPlan}) => (
            <TouchableOpacity
              style={[
                styles.floorListRow,
                {backgroundColor: theme.surface, borderColor: theme.border},
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
                  {tables.filter(t => t.floorPlanServerId === floor.serverId)
                    .length}{' '}
                  tables
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: theme.primary}]}
        onPress={() => setFloorModal({visible: true})}>
        <Icon name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Floor modal */}
      {floorModal.visible && (
        <FloorPlanModal
          floor={floorModal.floor}
          theme={theme}
          onClose={() => setFloorModal({visible: false})}
          onSaved={() => setFloorModal({visible: false})}
        />
      )}
    </SafeAreaView>
  );
}

// withObservables wires up reactive WatermelonDB queries
export default withObservables([], () => ({
  floors: floorPlansCollection.query().observeWithColumns(['name']),
  tables: diningTablesCollection
    .query()
    .observeWithColumns([
      'name',
      'capacity',
      'is_active',
      'floor_plan_server_id',
      'status',
    ]),
}))(TableManagerScreenInner);

// ─────────────────────────────────────────────────────────────────────────────
// FloorTableCard
// ─────────────────────────────────────────────────────────────────────────────

function FloorTableCard({
  table,
  theme,
  onPress,
}: {
  table: DiningTable;
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
      {!table.isActive && (
        <View style={styles.inactiveBadge}>
          <Text style={styles.inactiveBadgeText}>Inactive</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootTableCard
// ─────────────────────────────────────────────────────────────────────────────

function RootTableCard({table, theme}: {table: DiningTable; theme: any}) {
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
// FloorMenuSheet — iOS-style ActionSheet
// ─────────────────────────────────────────────────────────────────────────────

function FloorMenuSheet({
  floor,
  theme,
  onClose,
  onAddTable,
  onBulkTable,
  onEdit,
  onDelete,
}: {
  floor: FloorPlan;
  theme: any;
  onClose: () => void;
  onAddTable: () => void;
  onBulkTable: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.asScrim, {backgroundColor: theme.scrim}]}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.asWrap, {paddingBottom: Math.max(insets.bottom, 12)}]}>
        <View style={[styles.asSheet, {backgroundColor: theme.surface}]}>
          <View style={[styles.asTitleRow, {borderBottomColor: theme.border}]}>
            <Text style={[styles.asTitle, {color: theme.textSecondary}]}>
              {floor.name}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.asOption, {borderBottomColor: theme.border}]}
            onPress={onAddTable}>
            <Text style={[styles.asOptionText, {color: theme.primary}]}>
              Add Table
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.asOption, {borderBottomColor: theme.border}]}
            onPress={onBulkTable}>
            <Text style={[styles.asOptionText, {color: theme.primary}]}>
              Bulk Add Tables
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.asOption, {borderBottomColor: theme.border}]}
            onPress={onEdit}>
            <Text style={[styles.asOptionText, {color: theme.primary}]}>
              Edit Name
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.asOption} onPress={onDelete}>
            <Text style={[styles.asOptionText, {color: '#dc2626'}]}>
              Delete Floor
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.asCancel, {backgroundColor: theme.surface}]}
          onPress={onClose}>
          <Text style={[styles.asCancelText, {color: theme.primary}]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloorPlanModal — create or edit a floor plan
// ─────────────────────────────────────────────────────────────────────────────

function FloorPlanModal({
  floor,
  theme,
  onClose,
  onSaved,
}: {
  floor?: FloorPlan;
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
        // Edit existing floor plan — write locally, push fire-and-forget
        await database.write(async () => {
          await floor.update(rec => {
            rec.name = name.trim();
            rec.syncState = 'pending';
          });
        });
        if (floor.serverId && !floor.serverId.startsWith('local_')) {
          floorPlansApi.update(floor.serverId, {name: name.trim()})
            .then(async () => {
              await database.write(async () => {
                await floor.update(rec => {rec.syncState = 'synced';});
              });
            })
            .catch(() => {});
        }
      } else {
        // Create new floor plan — write locally with placeholder, push fire-and-forget
        const localId = generateLocalId();
        let localRecord: any;
        await database.write(async () => {
          localRecord = await floorPlansCollection.create(rec => {
            rec.serverId = localId;
            rec.name = name.trim();
            rec.syncState = 'pending';
          });
        });
        floorPlansApi.create({name: name.trim()})
          .then(async remote => {
            await database.write(async () => {
              await localRecord.update((rec: any) => {
                rec.serverId = remote.id;
                rec.syncState = 'synced';
              });
              // Fix any tables already created under this local placeholder
              const related = await diningTablesCollection
                .query(Q.where('floor_plan_server_id', localId))
                .fetch();
              for (const t of related) {
                await t.update((rec: any) => {rec.floorPlanServerId = remote.id;});
              }
            });
          })
          .catch(() => {});
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Failed to save', err?.message ?? 'Error');
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
            <Text style={styles.saveBtnText}>{floor ? 'Update' : 'Create'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TableModal — create or edit a dining table
// ─────────────────────────────────────────────────────────────────────────────

function TableModal({
  table,
  floorPlan,
  theme,
  onClose,
  onSaved,
  onDelete,
}: {
  table?: DiningTable;
  floorPlan: FloorPlan;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? '4'));
  const [isActive, setIsActive] = useState(table?.isActive ?? true);
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
        // Edit existing table — write locally, push fire-and-forget
        await database.write(async () => {
          await table.update(rec => {
            rec.name = name.trim();
            rec.capacity = cap;
            rec.isActive = isActive;
            rec.syncState = 'pending';
          });
        });
        if (table.serverId && !table.serverId.startsWith('local_')) {
          diningTablesApi.update(table.serverId, {name: name.trim(), capacity: cap, is_active: isActive})
            .then(async () => {
              await database.write(async () => {
                await table.update(rec => {rec.syncState = 'synced';});
              });
            })
            .catch(() => {});
        }
      } else {
        // Create new table — write locally with placeholder, push fire-and-forget
        const localId = generateLocalId();
        let localRecord: any;
        await database.write(async () => {
          localRecord = await diningTablesCollection.create(rec => {
            rec.serverId = localId;
            rec.floorPlanServerId = floorPlan.serverId ?? floorPlan.id;
            rec.name = name.trim();
            rec.capacity = cap;
            rec.isActive = true;
            rec.status = 'vacant';
            rec.currentOrderId = null;
            rec.syncState = 'pending';
          });
        });
        // Fire-and-forget requires a real floor plan server ID
        if (floorPlan.serverId && !floorPlan.serverId.startsWith('local_')) {
          diningTablesApi.create({floor_plan_id: floorPlan.serverId, name: name.trim(), capacity: cap})
            .then(async remote => {
              await database.write(async () => {
                await localRecord.update((rec: any) => {
                  rec.serverId = remote.id;
                  rec.status = remote.status;
                  rec.syncState = 'synced';
                });
              });
            })
            .catch(() => {});
        }
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Failed to save', err?.message ?? 'Error');
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
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
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
  floorPlan,
  theme,
  onClose,
  onSaved,
}: {
  floorPlan: FloorPlan;
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
  if (count > 5) {
    preview.push(`… (${count} total)`);
  }

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
    const fpServerId = floorPlan.serverId ?? floorPlan.id;
    const hasRealFloorId = !!(floorPlan.serverId && !floorPlan.serverId.startsWith('local_'));

    try {
      // Write all tables locally first — instant feedback
      const localRecords: any[] = [];
      await database.write(async () => {
        for (let n = fromN; n <= toN; n++) {
          const localId = generateLocalId();
          const rec = await diningTablesCollection.create((r: any) => {
            r.serverId = localId;
            r.floorPlanServerId = fpServerId;
            r.name = `${prefix.trim()}${n}`;
            r.capacity = cap;
            r.isActive = true;
            r.status = 'vacant';
            r.currentOrderId = null;
            r.syncState = 'pending';
          });
          localRecords.push({rec, localId, name: `${prefix.trim()}${n}`});
        }
      });
      setProgress(localRecords.length);
      Alert.alert('Done', `${localRecords.length} table${localRecords.length !== 1 ? 's' : ''} created.`);
      onSaved();

      // Fire-and-forget server push for each table (only if floor plan is synced)
      if (hasRealFloorId) {
        for (const {rec, name: tName} of localRecords) {
          diningTablesApi.create({floor_plan_id: floorPlan.serverId!, name: tName, capacity: cap})
            .then(async remote => {
              await database.write(async () => {
                await rec.update((r: any) => {
                  r.serverId = remote.id;
                  r.status = remote.status;
                  r.syncState = 'synced';
                });
              });
            })
            .catch(() => {});
        }
      }
    } catch (err: any) {
      Alert.alert('Failed to create tables', err?.message ?? 'Error');
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
            <Text style={[styles.previewLabel, {color: theme.textSecondary}]}>
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
            <Text style={[styles.progressText, {color: theme.textPrimary}]}>
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // collapsible header
  collapseHeader: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collapseTitle: {fontSize: 20, fontWeight: '700', marginBottom: 2},
  collapseSub: {fontSize: 13},

  // tab bar
  tabBar: {flexDirection: 'row', borderBottomWidth: 1},
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

  // table cards
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

  // empty
  emptyBig: {fontSize: 48, marginBottom: 8},
  emptyHint: {fontSize: 13, textAlign: 'center', lineHeight: 20},

  // modal sheet
  sheetWrap: {flex: 1, justifyContent: 'flex-end'},
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

  // form
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

  // bulk modal
  rangeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  rangeField: {flex: 1},
  rangeLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  rangeDash: {fontSize: 18, paddingBottom: 10},
  previewBox: {marginTop: 14, borderRadius: 8, borderWidth: 1, padding: 10},
  previewLabel: {fontSize: 11, fontWeight: '700', marginBottom: 4},
  previewNames: {fontSize: 13, lineHeight: 20},
  progressWrap: {
    marginTop: 12,
    borderRadius: 6,
    overflow: 'hidden',
    height: 22,
    justifyContent: 'center',
  },
  progressBar: {position: 'absolute', left: 0, top: 0, bottom: 0},
  progressText: {fontSize: 11, textAlign: 'center', fontWeight: '600', zIndex: 1},

  // modal buttons
  modalActions: {flexDirection: 'row', gap: 8, marginTop: 16},
  cancelBtn: {flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center'},
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

  // action sheet
  asScrim: {...StyleSheet.absoluteFillObject},
  asWrap: {position: 'absolute', bottom: 0, left: 12, right: 12, gap: 8},
  asSheet: {borderRadius: 14, overflow: 'hidden'},
  asTitleRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  asTitle: {fontSize: 13, fontWeight: '500'},
  asOption: {
    paddingVertical: 17,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  asOptionText: {fontSize: 17, fontWeight: '400'},
  asCancel: {borderRadius: 14, paddingVertical: 17, alignItems: 'center'},
  asCancelText: {fontSize: 17, fontWeight: '600'},
});
