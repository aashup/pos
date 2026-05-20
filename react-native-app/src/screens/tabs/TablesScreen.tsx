import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import withObservables from '@nozbe/with-observables';

import {diningTablesCollection, floorPlansCollection} from '@/src/db';
import DiningTable from '@/src/db/models/DiningTable';
import FloorPlan from '@/src/db/models/FloorPlan';
import Header from '@/src/components/Header';
import TableCard from '@/src/components/pos/TableCard';
import {useCartStore} from '@/src/store/cartStore';
import {useTheme} from '@/src/store/themeStore';
import {
  startOrder,
  findActiveOrderForTable,
  resumeOrder,
} from '@/src/lib/orderActions';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import type {RootStackParamList} from '@/src/navigation/types';

type Props = {tables: DiningTable[]; floorPlans: FloorPlan[]};

function TablesScreenInner({tables, floorPlans}: Props) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const [activeFp, setActiveFp] = useState<string | null>(null);

  const currentFp = activeFp ?? floorPlans[0]?.serverId ?? null;

  const filtered = useMemo(() => {
    if (!currentFp) return tables;
    return tables.filter(t => t.floorPlanServerId === currentFp);
  }, [tables, currentFp]);

  async function handlePress(t: DiningTable) {
    try {
      if (t.status === 'vacant') {
        await startOrder({
          orderType: 'dine_in',
          tableServerId: t.serverId ?? null,
          tableName: t.name,
        });
        useCartStore.getState().setTable({
          id: t.id,
          serverId: t.serverId ?? '',
          name: t.name,
        });
        nav.navigate('Tabs' as any, {screen: 'Billing'} as any);
      } else if (t.status === 'occupied') {
        const existing = await findActiveOrderForTable(t.serverId ?? '');
        if (existing) {
          await resumeOrder(existing.id);
          nav.navigate('Tabs' as any, {screen: 'Billing'} as any);
        } else {
          triggerSyncNow();
          Alert.alert(
            'Order not found locally',
            'This table is occupied on the server. Syncing now — please try again in a moment.',
          );
        }
      } else {
        Alert.alert(t.name, `Status: ${t.status}`);
      }
    } catch (err: any) {
      Alert.alert('Could not open table', err?.message ?? String(err));
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <Header title="Tables" />

      {floorPlans.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.fpRow, {backgroundColor: theme.surface, borderBottomColor: theme.border}]}
          contentContainerStyle={styles.fpRowContent}>
          {floorPlans.map(fp => {
            const active = fp.serverId === currentFp;
            return (
              <TouchableOpacity
                key={fp.id}
                onPress={() => setActiveFp(fp.serverId ?? null)}
                style={[
                  styles.fpTab,
                  {backgroundColor: theme.surface, borderColor: theme.border},
                  active && styles.fpTabActive,
                ]}>
                <Text
                  style={[
                    styles.fpTabText,
                    {color: theme.textSecondary},
                    active && styles.fpTabTextActive,
                  ]}>
                  {fp.name || 'Floor'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        renderItem={({item, index}) => <TableCard table={item} onPress={handlePress} index={index} />}
        numColumns={3}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.grid}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            No tables on this floor plan.
          </Text>
        }
      />
    </View>
  );
}

export default withObservables([], () => ({
  tables: diningTablesCollection
    .query()
    .observeWithColumns(['name', 'status', 'floor_plan_server_id']),
  floorPlans: floorPlansCollection.query().observeWithColumns(['name']),
}))(TablesScreenInner);

const styles = StyleSheet.create({
  screen: {flex: 1},
  fpRow: {maxHeight: 48, borderBottomWidth: 1},
  fpRowContent: {padding: 8, gap: 6, alignItems: 'center'},
  fpTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  fpTabActive: {backgroundColor: '#0ea5e9', borderColor: '#0ea5e9'},
  fpTabText: {fontSize: 12, fontWeight: '600'},
  fpTabTextActive: {color: '#fff'},
  grid: {padding: 8},
  empty: {textAlign: 'center', padding: 24},
  emptyContainer: {flex: 1, justifyContent: 'center'},
});
