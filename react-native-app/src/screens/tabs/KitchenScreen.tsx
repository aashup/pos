import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';

import {kotsCollection} from '@/src/db';
import Kot from '@/src/db/models/Kot';
import KotCard from '@/src/components/kitchen/KotCard';
import Header from '@/src/components/Header';
import {useTheme} from '@/src/store/themeStore';

type Props = {kots: Kot[]};

const COLUMNS: {key: string; label: string; color: string}[] = [
  {key: 'new', label: 'New', color: '#f59e0b'},
  {key: 'in_progress', label: 'Cooking', color: '#3b82f6'},
  {key: 'ready', label: 'Ready', color: '#16a34a'},
];

function KitchenScreenInner({kots}: Props) {
  const theme = useTheme();

  const byStatus = useMemo(() => {
    const map: Record<string, Kot[]> = {new: [], in_progress: [], ready: []};
    for (const k of kots) {
      if (map[k.status]) {
        map[k.status].push(k);
      }
    }
    return map;
  }, [kots]);

  const kotCountBadge = (
    <Text style={[styles.kotCount, {color: theme.textSecondary}]}>
      {kots.length} active KOT{kots.length !== 1 ? 's' : ''}
    </Text>
  );

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <Header title="Kitchen" right={kotCountBadge} />

      {kots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🍳</Text>
          <Text style={[styles.emptyText, {color: theme.textSecondary}]}>
            No active KOTs
          </Text>
          <Text style={[styles.emptyHint, {color: theme.textMuted}]}>
            Send a KOT from the Billing screen to see it here.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanban}>
          {COLUMNS.map(col => {
            const colKots = byStatus[col.key] ?? [];
            return (
              <View key={col.key} style={styles.column}>
                <View
                  style={[
                    styles.columnHeader,
                    {backgroundColor: theme.surface, borderTopColor: col.color},
                  ]}>
                  <Text style={[styles.columnTitle, {color: col.color}]}>
                    {col.label}
                  </Text>
                  <View style={[styles.countBadge, {backgroundColor: col.color}]}>
                    <Text style={styles.countBadgeText}>{colKots.length}</Text>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.columnContent}>
                  {colKots.length === 0 ? (
                    <View style={[styles.emptyCol, {borderColor: theme.border}]}>
                      <Text style={[styles.emptyColText, {color: theme.textMuted}]}>
                        –
                      </Text>
                    </View>
                  ) : (
                    colKots.map(k => <KotCard key={k.id} kot={k} />)
                  )}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default withObservables([], () => ({
  kots: kotsCollection
    .query(Q.where('status', Q.notEq('served')))
    .observeWithColumns(['status']),
}))(KitchenScreenInner);

const styles = StyleSheet.create({
  screen: {flex: 1},

  kotCount: {fontSize: 12},

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {fontSize: 40, marginBottom: 12},
  emptyText: {fontSize: 16, fontWeight: '700', marginBottom: 6},
  emptyHint: {fontSize: 12, textAlign: 'center'},

  kanban: {padding: 10, gap: 10, alignItems: 'flex-start'},
  column: {width: 240, maxHeight: '100%'},
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 2,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {fontSize: 11, fontWeight: '800', color: '#fff'},

  columnContent: {paddingBottom: 20},

  emptyCol: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  emptyColText: {fontSize: 18},
});
