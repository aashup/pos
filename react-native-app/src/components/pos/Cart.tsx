import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import {useCartStore, CartLine} from '@/src/store/cartStore';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';

type Props = {
  onSendKot: () => void;
  onPay: () => void;
};

function LineRow({line}: {line: CartLine}) {
  const theme = useTheme();
  const incrementQty = useCartStore(s => s.incrementQty);
  const decrementQty = useCartStore(s => s.decrementQty);
  const removeItem = useCartStore(s => s.removeItem);
  const setNote = useCartStore(s => s.setNote);
  const [showNote, setShowNote] = React.useState(false);

  const sentBadge = line.sent ? (
    <View style={[styles.sentPill, {backgroundColor: theme.surfaceAlt}]}>
      <Text style={[styles.sentPillText, {color: theme.textPrimary}]}>
        {line.kotStatus}
      </Text>
    </View>
  ) : null;

  return (
    <View
      style={[
        styles.row,
        {borderBottomColor: theme.borderLight},
        line.sent && {backgroundColor: theme.bg},
      ]}>
      <View style={{flex: 1}}>
        <View style={styles.headRow}>
          <Text style={[styles.lineName, {color: theme.textPrimary}]} numberOfLines={1}>
            {line.itemName}
            {line.variantName ? ` · ${line.variantName}` : ''}
          </Text>
          {sentBadge}
        </View>
        <Text style={[styles.lineMeta, {color: theme.textSecondary}]}>
          {formatCurrency(line.price)} × {line.quantity} ={' '}
          <Text style={[styles.lineTotal, {color: theme.textPrimary}]}>
            {formatCurrency(line.price * line.quantity)}
          </Text>
        </Text>
        {!line.sent && (
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, {backgroundColor: '#e0f2fe'}]}
              onPress={() => decrementQty(line.lineId)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.qtyText, {color: theme.textPrimary}]}>
              {line.quantity}
            </Text>
            <TouchableOpacity
              style={[styles.qtyBtn, {backgroundColor: '#e0f2fe'}]}
              onPress={() => incrementQty(line.lineId)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        {showNote && !line.sent && (
          <TextInput
            style={styles.noteInput}
            value={line.note ?? ''}
            onChangeText={t => setNote(line.lineId, t)}
            placeholder="Chef note (e.g. no onion)"
            placeholderTextColor="#a8a29e"
            autoFocus
            multiline
          />
        )}
        {line.note && !showNote && (
          <Text style={styles.notePreview} numberOfLines={1}>
            note: {line.note}
          </Text>
        )}
      </View>
      {!line.sent && (
        <View style={styles.lineActions}>
          <TouchableOpacity
            style={[styles.iconBtn, {borderColor: theme.border}]}
            onPress={() => setShowNote(s => !s)}>
            <Text style={styles.iconBtnText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnRed]}
            onPress={() => removeItem(line.lineId)}>
            <Text style={styles.iconBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function Cart({onSendKot, onPay}: Props) {
  const theme = useTheme();
  const lines = useCartStore(s => s.lines);
  const table = useCartStore(s => s.table);
  const orderType = useCartStore(s => s.orderType);
  const computeTotals = useCartStore(s => s.computeTotals);
  const totals = computeTotals();

  return (
    <View style={[styles.cart, {backgroundColor: theme.surface, borderLeftColor: theme.border}]}>
      <View style={[styles.cartHeader, {borderBottomColor: theme.border}]}>
        <Text style={[styles.cartTitle, {color: theme.textPrimary}]}>
          {table?.name ?? (orderType === 'takeaway' ? 'Takeaway' : 'New order')}
        </Text>
        <Text style={[styles.cartSubtitle, {color: theme.textSecondary}]}>
          {orderType.replace('_', ' ')}
        </Text>
      </View>

      <FlatList
        data={lines}
        keyExtractor={l => l.lineId}
        renderItem={({item}) => <LineRow line={item} />}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: theme.textMuted}]}>
            Tap an item on the left to add it.
          </Text>
        }
        contentContainerStyle={lines.length === 0 ? styles.emptyContainer : undefined}
        style={{flex: 1}}
      />

      <View style={[styles.totals, {borderTopColor: theme.border, backgroundColor: theme.bg}]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>Subtotal</Text>
          <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
            {formatCurrency(totals.subtotal)}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>
            CGST{' '}
            <Text style={[styles.totalLabelSm, {color: theme.textMuted}]}>
              ({formatCurrency(totals.cgstTotal)})
            </Text>{' '}
            + SGST{' '}
            <Text style={[styles.totalLabelSm, {color: theme.textMuted}]}>
              ({formatCurrency(totals.sgstTotal)})
            </Text>
          </Text>
          <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
            {formatCurrency(totals.cgstTotal + totals.sgstTotal)}
          </Text>
        </View>
        {totals.roundOff !== 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, {color: theme.textSecondary}]}>Round off</Text>
            <Text style={[styles.totalValue, {color: theme.textPrimary}]}>
              {formatCurrency(totals.roundOff)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.totalRow,
            styles.totalRowGrand,
            {borderTopColor: theme.border},
          ]}>
          <Text style={[styles.grandLabel, {color: theme.textPrimary}]}>Total</Text>
          <Text style={[styles.grandValue, {color: theme.textPrimary}]}>
            {formatCurrency(totals.netPayable)}
          </Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnKot, totals.unsentCount === 0 && styles.btnDisabled]}
            onPress={onSendKot}
            disabled={totals.unsentCount === 0}>
            <Text style={styles.btnText}>
              Send KOT
              {totals.unsentCount > 0 ? ` (${totals.unsentCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPay, lines.length === 0 && styles.btnDisabled]}
            onPress={onPay}
            disabled={lines.length === 0}>
            <Text style={styles.btnText}>Pay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cart: {flex: 1, borderLeftWidth: 1},
  cartHeader: {padding: 12, borderBottomWidth: 1},
  cartTitle: {fontSize: 16, fontWeight: '700'},
  cartSubtitle: {fontSize: 11, textTransform: 'capitalize'},

  empty: {textAlign: 'center', padding: 24, fontSize: 13},
  emptyContainer: {flex: 1, justifyContent: 'center'},

  row: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  lineName: {flex: 1, fontSize: 14, fontWeight: '600'},
  lineMeta: {fontSize: 12, marginTop: 2},
  lineTotal: {fontWeight: '700'},
  qtyRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6},
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {fontSize: 16, color: '#075985', fontWeight: '700'},
  qtyText: {fontSize: 14, fontWeight: '700', minWidth: 24, textAlign: 'center'},
  noteInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    minHeight: 40,
  },
  notePreview: {marginTop: 4, fontSize: 11, color: '#a16207', fontStyle: 'italic'},
  sentPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sentPillText: {fontSize: 9, fontWeight: '700', textTransform: 'uppercase'},

  lineActions: {alignItems: 'center', justifyContent: 'flex-start', gap: 4, marginLeft: 4},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnRed: {borderColor: '#fecaca'},
  iconBtnText: {fontSize: 14},

  totals: {padding: 12, borderTopWidth: 1},
  totalRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2},
  totalLabel: {fontSize: 12},
  totalLabelSm: {fontSize: 11},
  totalValue: {fontSize: 12, fontWeight: '600'},
  totalRowGrand: {marginTop: 6, paddingTop: 6, borderTopWidth: 1},
  grandLabel: {fontSize: 14, fontWeight: '700'},
  grandValue: {fontSize: 16, fontWeight: '800'},

  btnRow: {flexDirection: 'row', gap: 8, marginTop: 10},
  btn: {flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center'},
  btnKot: {backgroundColor: '#0ea5e9'},
  btnPay: {backgroundColor: '#16a34a'},
  btnDisabled: {opacity: 0.4},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 14},
});
