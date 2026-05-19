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

import {useTheme} from '@/src/store/themeStore';
import {
  floorPlansApi,
  diningTablesApi,
  RemoteFloorPlan,
  RemoteDiningTable,
} from '@/src/api/tables';
import Header from '@/src/components/Header';

type Shape = 'square' | 'round' | 'rectangle';
const SHAPES: Shape[] = ['square', 'round', 'rectangle'];
const SHAPE_EMOJI: Record<Shape, string> = {
  square: '⬛',
  round: '⭕',
  rectangle: '▬',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TableManagerScreen() {
  const theme = useTheme();

  const [floors, setFloors] = useState<RemoteFloorPlan[]>([]);
  const [tables, setTables] = useState<RemoteDiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  // modal state
  const [floorModal, setFloorModal] = useState<{
    visible: boolean;
    floor?: RemoteFloorPlan;
  }>({visible: false});
  const [tableModal, setTableModal] = useState<{
    visible: boolean;
    table?: RemoteDiningTable;
  }>({visible: false});
  const [bulkModal, setBulkModal] = useState(false);

  const activeFloor = floors.find(f => f.id === activeFloorId) ?? floors[0] ?? null;
  const floorTables = tables.filter(
    t => t.floor_plan_id === activeFloor?.id,
  );

  // ── load ──
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([floorPlansApi.list(), diningTablesApi.list()]);
      setFloors(f);
      setTables(t);
      if (!activeFloorId && f.length > 0) setActiveFloorId(f[0].id);
    } catch {
      Alert.alert('Error', 'Failed to load tables. Check server connection.');
    } finally {
      setLoading(false);
    }
  }, [activeFloorId]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── floor delete ──
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
              if (activeFloorId === floor.id) setActiveFloorId(null);
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

  // ── table delete ──
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

  return (
    <SafeAreaView style={[styles.screen, {backgroundColor: theme.bg}]} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Table Manager" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          {/* ── Left sidebar: floor plans ── */}
          <View
            style={[
              styles.sidebar,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}>
            {/* sidebar header */}
            <View
              style={[
                styles.sidebarHeader,
                {borderColor: theme.border},
              ]}>
              <Text
                style={[styles.sidebarHeaderText, {color: theme.textSecondary}]}>
                FLOORS
              </Text>
              <TouchableOpacity
                style={styles.addFloorBtn}
                onPress={() => setFloorModal({visible: true})}>
                <Text style={styles.addFloorBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            {/* floor list */}
            <FlatList
              data={floors}
              keyExtractor={f => f.id}
              renderItem={({item: floor}) => {
                const active = activeFloor?.id === floor.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.floorRow,
                      active && {
                        backgroundColor: '#fef3c7',
                        borderLeftColor: '#f59e0b',
                        borderLeftWidth: 3,
                      },
                    ]}
                    onPress={() => setActiveFloorId(floor.id)}>
                    <Text
                      style={[
                        styles.floorRowText,
                        {color: active ? '#92400e' : theme.textPrimary},
                        active && {fontWeight: '700'},
                      ]}
                      numberOfLines={1}>
                      🏢 {floor.name}
                    </Text>
                    {active && (
                      <View style={styles.floorRowActions}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() =>
                            setFloorModal({visible: true, floor})
                          }>
                          <Text style={styles.iconBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => confirmDeleteFloor(floor)}>
                          <Text style={styles.iconBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, {color: theme.textMuted}]}>
                  No floor plans.{'\n'}Tap ＋ to add one.
                </Text>
              }
            />
          </View>

          {/* ── Right panel: tables ── */}
          <View style={styles.panel}>
            {!activeFloor ? (
              <View style={styles.center}>
                <Text style={[styles.emptyBig, {color: theme.textMuted}]}>
                  🏢
                </Text>
                <Text style={[styles.emptyHint, {color: theme.textSecondary}]}>
                  Select or create a floor plan
                </Text>
              </View>
            ) : (
              <>
                {/* panel header */}
                <View
                  style={[
                    styles.panelHeader,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}>
                  <View>
                    <Text
                      style={[styles.panelTitle, {color: theme.textPrimary}]}>
                      {activeFloor.name}
                    </Text>
                    <Text
                      style={[
                        styles.panelSubtitle,
                        {color: theme.textSecondary},
                      ]}>
                      {floorTables.length} table
                      {floorTables.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.panelHeaderBtns}>
                    <TouchableOpacity
                      style={[styles.addTableBtn, styles.bulkBtn]}
                      onPress={() => setBulkModal(true)}>
                      <Text style={styles.addTableBtnText}>⚡ Bulk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addTableBtn}
                      onPress={() => setTableModal({visible: true})}>
                      <Text style={styles.addTableBtnText}>＋ Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* table grid */}
                <FlatList
                  data={floorTables}
                  keyExtractor={t => t.id}
                  numColumns={2}
                  contentContainerStyle={styles.tableGrid}
                  columnWrapperStyle={styles.tableGridRow}
                  renderItem={({item: table}) => (
                    <TableCard
                      table={table}
                      theme={theme}
                      onEdit={() => setTableModal({visible: true, table})}
                      onDelete={() => confirmDeleteTable(table)}
                    />
                  )}
                  ListEmptyComponent={
                    <View style={styles.center}>
                      <Text
                        style={[styles.emptyBig, {color: theme.textMuted}]}>
                        🪑
                      </Text>
                      <Text
                        style={[
                          styles.emptyHint,
                          {color: theme.textSecondary},
                        ]}>
                        No tables on this floor.{'\n'}Tap "＋ Add Table" to
                        create one.
                      </Text>
                    </View>
                  }
                />
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Bulk create modal ── */}
      {bulkModal && activeFloor && (
        <BulkCreateModal
          floorPlanId={activeFloor.id}
          theme={theme}
          onClose={() => setBulkModal(false)}
          onSaved={() => {
            setBulkModal(false);
            reload();
          }}
        />
      )}

      {/* ── Floor plan modal ── */}
      {floorModal.visible && (
        <FloorPlanModal
          floor={floorModal.floor}
          theme={theme}
          onClose={() => setFloorModal({visible: false})}
          onSaved={newFloor => {
            setFloorModal({visible: false});
            setActiveFloorId(newFloor.id);
            reload();
          }}
        />
      )}

      {/* ── Table modal ── */}
      {tableModal.visible && activeFloor && (
        <TableModal
          table={tableModal.table}
          floorPlanId={activeFloor.id}
          theme={theme}
          onClose={() => setTableModal({visible: false})}
          onSaved={() => {
            setTableModal({visible: false});
            reload();
          }}
        />
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TableCard
// ─────────────────────────────────────────────────────────────────────────────

function TableCard({
  table,
  theme,
  onEdit,
  onDelete,
}: {
  table: RemoteDiningTable;
  theme: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={[
        styles.tableCard,
        {
          backgroundColor: table.is_active ? theme.surface : theme.surfaceAlt,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.tableCardTop}>
        <Text style={[styles.tableName, {color: theme.textPrimary}]}>
          {table.name}
        </Text>
        {!table.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tableMeta, {color: theme.textSecondary}]}>
        {SHAPE_EMOJI[table.shape] ?? '⬛'} {table.shape} · {table.capacity}{' '}
        seats
      </Text>
      <View style={styles.tableCardActions}>
        <TouchableOpacity style={styles.cardActionBtn} onPress={onEdit}>
          <Text style={[styles.cardActionText, {color: theme.primary}]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardActionBtn} onPress={onDelete}>
          <Text style={[styles.cardActionText, {color: '#dc2626'}]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
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
  onSaved: (f: RemoteFloorPlan) => void;
}) {
  const [name, setName] = useState(floor?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = floor
        ? await floorPlansApi.update(floor.id, {name: name.trim()})
        : await floorPlansApi.create({name: name.trim()});
      onSaved(result);
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
          style={[styles.saveBtn, (!name.trim() || saving) && {opacity: 0.5}]}
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
}: {
  table?: RemoteDiningTable;
  floorPlanId: string;
  theme: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? '4'));
  const [shape, setShape] = useState<Shape>(table?.shape ?? 'square');
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
          shape,
          is_active: isActive,
        });
      } else {
        await diningTablesApi.create({
          floor_plan_id: floorPlanId,
          name: name.trim(),
          capacity: cap,
          shape,
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
          style={[styles.fieldLabel, {color: theme.textSecondary, marginTop: 12}]}>
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

        {/* Shape */}
        <Text
          style={[styles.fieldLabel, {color: theme.textSecondary, marginTop: 12}]}>
          Shape
        </Text>
        <View style={styles.shapeRow}>
          {SHAPES.map(s => {
            const active = shape === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.shapeBtn,
                  {
                    backgroundColor: active ? '#fef3c7' : theme.surface,
                    borderColor: active ? '#f59e0b' : theme.border,
                  },
                ]}
                onPress={() => setShape(s)}>
                <Text style={styles.shapeEmoji}>{SHAPE_EMOJI[s]}</Text>
                <Text
                  style={[
                    styles.shapeLabel,
                    {color: active ? '#92400e' : theme.textSecondary},
                    active && {fontWeight: '700'},
                  ]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active toggle (edit only) */}
        {table && (
          <TouchableOpacity
            style={[styles.toggleRow, {marginTop: 16}]}
            onPress={() => setIsActive(v => !v)}>
            <View style={{flex: 1}}>
              <Text style={[styles.toggleLabel, {color: theme.textPrimary}]}>
                Active
              </Text>
              <Text
                style={[styles.toggleSub, {color: theme.textSecondary}]}>
                Inactive tables are hidden from the POS floor view
              </Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                {backgroundColor: isActive ? '#22c55e' : theme.border},
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
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text
              style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
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
// BulkCreateModal — prefix + range → auto-create tables
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
  const [shape, setShape] = useState<Shape>('square');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const fromN = Math.max(1, parseInt(from, 10) || 1);
  const toN = Math.max(fromN, parseInt(to, 10) || fromN);
  const count = toN - fromN + 1;

  // live preview of names
  const preview = Array.from({length: Math.min(count, 5)}, (_, i) => {
    const n = fromN + i;
    return `${prefix.trim()}${n}`;
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
          shape,
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
        {/* Prefix */}
        <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>
          Prefix
        </Text>
        <TextInput
          style={[styles.input, {backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary}]}
          value={prefix}
          onChangeText={setPrefix}
          placeholder="e.g. T, Table , A"
          placeholderTextColor={theme.textMuted}
          autoFocus
          autoCapitalize="characters"
        />

        {/* Range */}
        <Text style={[styles.fieldLabel, {color: theme.textSecondary, marginTop: 12}]}>
          Number range
        </Text>
        <View style={styles.rangeRow}>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>From</Text>
            <TextInput
              style={[styles.input, {backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary}]}
              value={from}
              onChangeText={setFrom}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <Text style={[styles.rangeDash, {color: theme.textMuted}]}>—</Text>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>To</Text>
            <TextInput
              style={[styles.input, {backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary}]}
              value={to}
              onChangeText={setTo}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <View style={styles.rangeField}>
            <Text style={[styles.rangeLabel, {color: theme.textMuted}]}>Seats</Text>
            <TextInput
              style={[styles.input, {backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary}]}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
              placeholder="4"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Shape */}
        <Text style={[styles.fieldLabel, {color: theme.textSecondary, marginTop: 12}]}>
          Shape
        </Text>
        <View style={styles.shapeRow}>
          {SHAPES.map(s => {
            const active = shape === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.shapeBtn, {backgroundColor: active ? '#fef3c7' : theme.surface, borderColor: active ? '#f59e0b' : theme.border}]}
                onPress={() => setShape(s)}>
                <Text style={styles.shapeEmoji}>{SHAPE_EMOJI[s]}</Text>
                <Text style={[styles.shapeLabel, {color: active ? '#92400e' : theme.textSecondary}, active && {fontWeight: '700'}]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview */}
        {prefix.trim().length > 0 && count > 0 && (
          <View style={[styles.previewBox, {backgroundColor: theme.bg, borderColor: theme.border}]}>
            <Text style={[styles.previewLabel, {color: theme.textSecondary}]}>
              Preview — {count} table{count !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.previewNames, {color: theme.textPrimary}]}>
              {preview.join('  ·  ')}
            </Text>
          </View>
        )}

        {/* Progress bar while saving */}
        {saving && (
          <View style={[styles.progressWrap, {backgroundColor: theme.border}]}>
            <View
              style={[
                styles.progressBar,
                {width: `${Math.round((progress / count) * 100)}%`},
              ]}
            />
            <Text style={[styles.progressText, {color: theme.textPrimary}]}>
              Creating {progress}/{count}…
            </Text>
          </View>
        )}

        <View style={[styles.modalActions, {marginTop: 20}]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
            <Text style={[styles.cancelBtnText, {color: theme.textSecondary}]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || count < 1) && {opacity: 0.5}]}
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
// ModalSheet — reusable bottom-style modal wrapper
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
      <TouchableOpacity
        style={styles.scrim}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          {/* handle */}
          <View style={[styles.sheetHandle, {backgroundColor: theme.border}]} />
          {/* title row */}
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
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  body: {flex: 1, flexDirection: 'row'},

  // sidebar
  sidebar: {
    width: 160,
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sidebarHeaderText: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5},
  addFloorBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFloorBtnText: {color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 22},

  floorRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  floorRowText: {fontSize: 13, flex: 1},
  floorRowActions: {flexDirection: 'row', marginTop: 6, gap: 4},
  iconBtn: {padding: 4},
  iconBtnText: {fontSize: 14},

  // panel
  panel: {flex: 1},
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  panelTitle: {fontSize: 15, fontWeight: '700'},
  panelSubtitle: {fontSize: 12, marginTop: 1},
  addTableBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addTableBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  panelHeaderBtns: {flexDirection: 'row', gap: 8},
  bulkBtn: {backgroundColor: '#7c3aed'},

  // range row
  rangeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  rangeField: {flex: 1},
  rangeLabel: {fontSize: 11, marginBottom: 4, fontWeight: '600'},
  rangeDash: {fontSize: 18, paddingBottom: 10},

  // preview
  previewBox: {
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  previewLabel: {fontSize: 11, fontWeight: '700', marginBottom: 4},
  previewNames: {fontSize: 13, lineHeight: 20},

  // progress
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
    backgroundColor: '#f59e0b',
  },
  progressText: {fontSize: 11, textAlign: 'center', fontWeight: '600', zIndex: 1},

  tableGrid: {padding: 12, gap: 10},
  tableGridRow: {gap: 10},
  tableCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    minHeight: 100,
  },
  tableCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tableName: {fontSize: 15, fontWeight: '700', flex: 1},
  tableMeta: {fontSize: 12, marginBottom: 10},
  inactiveBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inactiveBadgeText: {fontSize: 10, color: '#64748b', fontWeight: '600'},
  tableCardActions: {flexDirection: 'row', gap: 12},
  cardActionBtn: {paddingVertical: 4},
  cardActionText: {fontSize: 13, fontWeight: '600'},

  // empty states
  emptyText: {fontSize: 12, textAlign: 'center', padding: 16, lineHeight: 20},
  emptyBig: {fontSize: 48, marginBottom: 8},
  emptyHint: {fontSize: 13, textAlign: 'center', lineHeight: 20},

  // modal sheet
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  shapeRow: {flexDirection: 'row', gap: 8},
  shapeBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  shapeEmoji: {fontSize: 18},
  shapeLabel: {fontSize: 12},

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

  // modal buttons
  modalActions: {flexDirection: 'row', gap: 10, marginTop: 16},
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {fontSize: 14, fontWeight: '600'},
  saveBtn: {
    flex: 2,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {color: '#fff', fontSize: 14, fontWeight: '700'},
});
