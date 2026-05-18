import React, {useMemo, useState} from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {formatCurrency} from '@/src/lib/utils';
import {CartTotals} from '@/src/store/cartStore';

type PaymentMode = 'cash' | 'upi' | 'card' | 'credit';
type SplitRow = {mode: PaymentMode; amount: number};

export type PaymentModalResult =
  | {
      payment_mode: PaymentMode;
      amount_tendered: number;
      change_amount: number;
      total_amount: number;
      cgst_total: number;
      sgst_total: number;
      amount_paid: number;
    }
  | {
      payment_mode: 'split';
      split_payments: SplitRow[];
      amount_tendered: number;
      change_amount: number;
      total_amount: number;
      cgst_total: number;
      sgst_total: number;
      amount_paid: number;
    };

type Props = {
  visible: boolean;
  totals: CartTotals;
  onClose: () => void;
  onConfirm: (result: PaymentModalResult) => void;
};

const MODES: {key: PaymentMode; label: string}[] = [
  {key: 'cash', label: 'Cash'},
  {key: 'upi', label: 'UPI'},
  {key: 'card', label: 'Card'},
  {key: 'credit', label: 'Credit'},
];

const QUICK_CASH = [100, 200, 500, 1000];

export default function PaymentModal({visible, totals, onClose, onConfirm}: Props) {
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [tenderedText, setTenderedText] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [split, setSplit] = useState<SplitRow[]>([{mode: 'cash', amount: 0}]);

  const tendered = parseFloat(tenderedText) || 0;
  const change = Math.max(0, tendered - totals.netPayable);

  const splitTotal = useMemo(
    () => split.reduce((s, r) => s + (r.amount || 0), 0),
    [split],
  );
  const splitRemaining = totals.netPayable - splitTotal;

  function reset() {
    setMode('cash');
    setTenderedText('');
    setSplitMode(false);
    setSplit([{mode: 'cash', amount: 0}]);
  }

  function handleConfirm() {
    if (splitMode) {
      if (Math.abs(splitRemaining) > 0.01) {
        Alert.alert(
          'Split amounts must equal total',
          `Remaining: ${formatCurrency(splitRemaining)}`,
        );
        return;
      }
      onConfirm({
        payment_mode: 'split',
        split_payments: split.filter(r => r.amount > 0),
        amount_tendered: split.reduce((s, r) => s + (r.amount || 0), 0),
        change_amount: 0,
        total_amount: totals.netPayable,
        cgst_total: totals.cgstTotal,
        sgst_total: totals.sgstTotal,
        amount_paid: totals.netPayable,
      });
      reset();
      return;
    }

    if (mode === 'cash' && tendered < totals.netPayable) {
      Alert.alert('Insufficient cash', 'Tendered amount is less than total.');
      return;
    }
    onConfirm({
      payment_mode: mode,
      amount_tendered: mode === 'cash' ? tendered : totals.netPayable,
      change_amount: mode === 'cash' ? change : 0,
      total_amount: totals.netPayable,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      amount_paid: totals.netPayable,
    });
    reset();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Payment</Text>
            <Text style={styles.headerTotal}>{formatCurrency(totals.netPayable)}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 14}}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, !splitMode && styles.modeBtnActive]}
                onPress={() => setSplitMode(false)}>
                <Text style={[styles.modeBtnText, !splitMode && styles.modeBtnTextActive]}>
                  Single
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, splitMode && styles.modeBtnActive]}
                onPress={() => setSplitMode(true)}>
                <Text style={[styles.modeBtnText, splitMode && styles.modeBtnTextActive]}>
                  Split
                </Text>
              </TouchableOpacity>
            </View>

            {!splitMode && (
              <>
                <View style={styles.choiceGrid}>
                  {MODES.map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.choice, mode === m.key && styles.choiceActive]}
                      onPress={() => setMode(m.key)}>
                      <Text
                        style={[
                          styles.choiceLabel,
                          mode === m.key && styles.choiceLabelActive,
                        ]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {mode === 'cash' && (
                  <>
                    <Text style={styles.label}>Cash tendered</Text>
                    <TextInput
                      style={styles.input}
                      value={tenderedText}
                      onChangeText={setTenderedText}
                      placeholder={formatCurrency(totals.netPayable)}
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.quickRow}>
                      {QUICK_CASH.map(amt => (
                        <TouchableOpacity
                          key={amt}
                          style={styles.quickBtn}
                          onPress={() => setTenderedText(String(amt))}>
                          <Text style={styles.quickBtnText}>₹{amt}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={styles.quickBtn}
                        onPress={() => setTenderedText(String(totals.netPayable))}>
                        <Text style={styles.quickBtnText}>Exact</Text>
                      </TouchableOpacity>
                    </View>
                    {tendered > 0 && (
                      <Text style={styles.changeText}>
                        Change: <Text style={styles.changeAmt}>{formatCurrency(change)}</Text>
                      </Text>
                    )}
                  </>
                )}
              </>
            )}

            {splitMode && (
              <View style={{gap: 8}}>
                {split.map((row, idx) => (
                  <View key={idx} style={styles.splitRow}>
                    <View style={{flex: 1, flexDirection: 'row', gap: 4}}>
                      {MODES.map(m => (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.splitMode, row.mode === m.key && styles.splitModeActive]}
                          onPress={() => {
                            const next = [...split];
                            next[idx] = {...row, mode: m.key};
                            setSplit(next);
                          }}>
                          <Text
                            style={[
                              styles.splitModeText,
                              row.mode === m.key && styles.splitModeTextActive,
                            ]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, {width: 100}]}
                      value={String(row.amount || '')}
                      onChangeText={t => {
                        const next = [...split];
                        next[idx] = {...row, amount: parseFloat(t) || 0};
                        setSplit(next);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                    {split.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setSplit(split.filter((_, i) => i !== idx))}>
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addSplitBtn}
                  onPress={() => setSplit([...split, {mode: 'cash', amount: 0}])}>
                  <Text style={styles.addSplitText}>+ Add payment line</Text>
                </TouchableOpacity>
                <View style={styles.splitTotalsRow}>
                  <Text style={styles.changeText}>
                    Paid: <Text style={styles.changeAmt}>{formatCurrency(splitTotal)}</Text>
                  </Text>
                  <Text
                    style={[
                      styles.changeText,
                      Math.abs(splitRemaining) > 0.01 && {color: '#dc2626'},
                    ]}>
                    Remaining:{' '}
                    <Text style={styles.changeAmt}>{formatCurrency(splitRemaining)}</Text>
                  </Text>
                </View>
                {Math.abs(splitRemaining) > 0.01 && split.length > 0 && (
                  <TouchableOpacity
                    style={styles.fillBtn}
                    onPress={() => {
                      const last = split[split.length - 1];
                      const next = [...split];
                      next[next.length - 1] = {
                        ...last,
                        amount: last.amount + splitRemaining,
                      };
                      setSplit(next);
                    }}>
                    <Text style={styles.fillBtnText}>Autofill remaining</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end'},
  sheet: {
    maxHeight: '90%',
    minHeight: '60%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a'},
  headerTotal: {fontSize: 18, fontWeight: '800', color: '#16a34a', marginRight: 12},
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {fontSize: 18, color: '#475569'},

  modeRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeBtnActive: {backgroundColor: '#0ea5e9', borderColor: '#0ea5e9'},
  modeBtnText: {fontSize: 13, fontWeight: '700', color: '#475569'},
  modeBtnTextActive: {color: '#fff'},

  choiceGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  choice: {
    minWidth: '47%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  choiceActive: {backgroundColor: '#e0f2fe', borderColor: '#0ea5e9'},
  choiceLabel: {fontSize: 14, fontWeight: '600', color: '#334155'},
  choiceLabelActive: {color: '#075985'},

  label: {fontSize: 12, color: '#334155', marginBottom: 6, marginTop: 8, fontWeight: '600'},
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },

  quickRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  quickBtnText: {fontSize: 13, color: '#0f172a', fontWeight: '700'},

  changeText: {marginTop: 12, fontSize: 13, color: '#334155'},
  changeAmt: {fontSize: 14, fontWeight: '800', color: '#16a34a'},

  splitRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  splitMode: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  splitModeActive: {backgroundColor: '#e0f2fe', borderColor: '#0ea5e9'},
  splitModeText: {fontSize: 11, color: '#334155', fontWeight: '600'},
  splitModeTextActive: {color: '#075985'},
  removeText: {fontSize: 18, color: '#dc2626', paddingHorizontal: 4},
  addSplitBtn: {paddingVertical: 8},
  addSplitText: {color: '#0ea5e9', fontWeight: '700', fontSize: 13},
  splitTotalsRow: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 6},
  fillBtn: {paddingVertical: 8},
  fillBtnText: {color: '#0ea5e9', fontWeight: '700', fontSize: 12},

  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelBtnText: {color: '#475569', fontWeight: '700'},
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  confirmBtnText: {color: '#fff', fontWeight: '800', fontSize: 15},
});
