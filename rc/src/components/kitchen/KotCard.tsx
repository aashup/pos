import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import withObservables from '@nozbe/with-observables';
import {Q} from '@nozbe/watermelondb';

import Kot from '@/src/db/models/Kot';
import OrderLine from '@/src/db/models/OrderLine';
import {orderLinesCollection} from '@/src/db';
import {advanceKotStatus} from '@/src/lib/orderActions';
import {printKot} from '@/src/lib/printer';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';

type Props = {kot: Kot; lines: OrderLine[]};

const STATUS_LABELS: Record<string, string> = {
  new: 'NEW',
  in_progress: 'COOKING',
  ready: 'READY',
  served: 'SERVED',
};

const NEXT_LABEL: Record<string, string> = {
  new: 'Start cooking',
  in_progress: 'Mark ready',
  ready: 'Mark served',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#f59e0b',
  in_progress: '#3b82f6',
  ready: '#16a34a',
  served: '#64748b',
};

function KotCardInner({kot, lines}: Props) {
  const theme = useTheme();
  const [printing, setPrinting] = useState(false);
  const canAdvance = kot.status !== 'served';
  const color = STATUS_COLORS[kot.status] ?? '#64748b';
  const shortId = kot.id.slice(-6).toUpperCase();

  async function handleReprint() {
    setPrinting(true);
    try {
      await printKot(kot.id);
    } catch (err: any) {
      Alert.alert('Print failed', err?.message ?? String(err));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <View style={[styles.card, {backgroundColor: theme.surface, borderTopColor: color}]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.kotId, {color: theme.textPrimary}]}>KOT #{shortId}</Text>
        <View style={[styles.statusPill, {backgroundColor: color}]}>
          <Text style={styles.statusText}>
            {STATUS_LABELS[kot.status] ?? kot.status}
          </Text>
        </View>
      </View>

      <View style={styles.linesList}>
        {lines.map(l => (
          <View key={l.id} style={styles.lineRow}>
            <Text style={[styles.lineQty, {color: theme.textMuted}]}>{l.quantity}×</Text>
            <Text style={[styles.lineName, {color: theme.textPrimary}]} numberOfLines={1}>
              {l.itemName}
              {l.variantName ? ` · ${l.variantName}` : ''}
            </Text>
            <Text style={[styles.linePrice, {color: theme.textSecondary}]}>
              {formatCurrency(l.price)}
            </Text>
          </View>
        ))}
        {lines.length === 0 && (
          <Text style={[styles.emptyLines, {color: theme.textMuted}]}>No lines</Text>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.reprintBtn, {borderColor: theme.border}]}
          onPress={handleReprint}
          disabled={printing}>
          {printing
            ? <ActivityIndicator size="small" color={theme.textMuted} />
            : <Text style={styles.reprintBtnText}>🖨</Text>}
        </TouchableOpacity>

        {canAdvance && (
          <TouchableOpacity
            style={[styles.advanceBtn, {borderColor: color}]}
            activeOpacity={0.75}
            onPress={() => advanceKotStatus(kot.id)}>
            <Text style={[styles.advanceBtnText, {color}]}>
              {NEXT_LABEL[kot.status] ?? '→'} →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default withObservables(['kot'], ({kot}: {kot: Kot}) => ({
  kot: kot.observe(),
  lines: orderLinesCollection.query(Q.where('kot_id', kot.id)).observe(),
}))(KotCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderTopWidth: 3,
    padding: 10,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kotId: {fontSize: 13, fontWeight: '800', letterSpacing: 0.5},
  statusPill: {paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999},
  statusText: {fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5},

  linesList: {gap: 4},
  lineRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  lineQty: {fontSize: 12, fontWeight: '800', minWidth: 22, textAlign: 'right'},
  lineName: {flex: 1, fontSize: 13, fontWeight: '600'},
  linePrice: {fontSize: 11},
  emptyLines: {fontSize: 12, fontStyle: 'italic'},

  actionRow: {flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center'},
  reprintBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reprintBtnText: {fontSize: 16},
  advanceBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  advanceBtnText: {fontSize: 12, fontWeight: '700'},
});
