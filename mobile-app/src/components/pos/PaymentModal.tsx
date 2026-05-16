import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { formatCurrency } from '@/lib/utils';
import type { PaymentData } from '@/lib/orderActions';

type PaymentMode = 'cash' | 'upi' | 'card' | 'credit';

interface Props {
  visible: boolean;
  netPayable: number;
  cgstTotal: number;
  sgstTotal: number;
  subtotal: number;
  onConfirm: (data: PaymentData) => void;
  onClose: () => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000];
const MODES: { key: PaymentMode; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'credit', label: 'Credit' },
];

export function PaymentModal({ visible, netPayable, cgstTotal, sgstTotal, subtotal, onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [amountStr, setAmountStr] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<Array<{ mode: PaymentMode; amountStr: string }>>([
    { mode: 'cash', amountStr: '' },
    { mode: 'upi', amountStr: '' },
  ]);

  const amountPaid = splitMode
    ? splits.reduce((s, sp) => s + (parseFloat(sp.amountStr) || 0), 0)
    : parseFloat(amountStr) || 0;
  const change = Math.max(0, amountPaid - netPayable);

  const handleConfirm = () => {
    if (splitMode) {
      const total = splits.reduce((s, sp) => s + (parseFloat(sp.amountStr) || 0), 0);
      if (Math.abs(total - netPayable) > 0.01) {
        Alert.alert('Split Error', `Split total ₹${total.toFixed(2)} must equal ₹${netPayable.toFixed(2)}`);
        return;
      }
      onConfirm({
        paymentMode: 'split',
        amountPaid: total,
        amountTendered: total,
        changeAmount: 0,
        cgstTotal,
        sgstTotal,
        splitPayments: splits.map((sp) => ({ mode: sp.mode, amount: parseFloat(sp.amountStr) || 0 })),
      });
    } else {
      if (amountPaid <= 0) {
        Alert.alert('Enter amount', 'Please enter the amount received.');
        return;
      }
      onConfirm({
        paymentMode: mode,
        amountPaid: netPayable,
        amountTendered: amountPaid,
        changeAmount: change,
        cgstTotal,
        sgstTotal,
      });
    }
  };

  const autofillRemaining = () => {
    const paid = splits.reduce((s, sp) => s + (parseFloat(sp.amountStr) || 0), 0);
    const remaining = netPayable - paid;
    if (remaining <= 0) return;
    const lastEmpty = [...splits].reverse().findIndex((sp) => !sp.amountStr);
    if (lastEmpty === -1) return;
    const idx = splits.length - 1 - lastEmpty;
    setSplits((prev) => prev.map((sp, i) => i === idx ? { ...sp, amountStr: remaining.toFixed(2) } : sp));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-400 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View className="bg-gray-50 rounded-xl p-3 mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-gray-500 text-sm">Subtotal</Text>
              <Text className="text-gray-700 text-sm">{formatCurrency(subtotal)}</Text>
            </View>
            {cgstTotal > 0 && (
              <>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-500 text-sm">CGST</Text>
                  <Text className="text-gray-700 text-sm">{formatCurrency(cgstTotal)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-500 text-sm">SGST</Text>
                  <Text className="text-gray-700 text-sm">{formatCurrency(sgstTotal)}</Text>
                </View>
              </>
            )}
            <View className="flex-row justify-between border-t border-gray-200 pt-2 mt-1">
              <Text className="font-bold text-gray-800">Net Payable</Text>
              <Text className="font-bold text-gray-800 text-base">{formatCurrency(netPayable)}</Text>
            </View>
          </View>

          {/* Split toggle */}
          <TouchableOpacity
            onPress={() => setSplitMode((v) => !v)}
            className="mb-4 self-end"
          >
            <Text className="text-amber-600 text-sm font-medium">
              {splitMode ? 'Single payment' : 'Split payment'}
            </Text>
          </TouchableOpacity>

          {!splitMode ? (
            <>
              {/* Mode selector */}
              <View className="flex-row mb-4 gap-2">
                {MODES.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMode(m.key)}
                    className={`flex-1 py-2.5 rounded-xl items-center ${mode === m.key ? 'bg-amber-500' : 'bg-gray-100'}`}
                  >
                    <Text className={`text-sm font-semibold ${mode === m.key ? 'text-white' : 'text-gray-600'}`}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'cash' && (
                <>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base mb-3"
                    placeholder="Amount received"
                    keyboardType="numeric"
                    value={amountStr}
                    onChangeText={setAmountStr}
                  />
                  <View className="flex-row gap-2 mb-3">
                    {QUICK_AMOUNTS.map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setAmountStr(String(amt))}
                        className="flex-1 bg-gray-100 py-2 rounded-lg items-center"
                      >
                        <Text className="text-gray-700 text-xs font-medium">₹{amt}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setAmountStr(netPayable.toFixed(2))}
                      className="flex-1 bg-gray-100 py-2 rounded-lg items-center"
                    >
                      <Text className="text-gray-700 text-xs font-medium">Exact</Text>
                    </TouchableOpacity>
                  </View>
                  {amountPaid > 0 && (
                    <View className="flex-row justify-between mb-3">
                      <Text className="text-gray-500 text-sm">Change</Text>
                      <Text className="font-semibold text-green-600">{formatCurrency(change)}</Text>
                    </View>
                  )}
                </>
              )}
            </>
          ) : (
            <ScrollView className="mb-3 max-h-48">
              {splits.map((sp, idx) => (
                <View key={idx} className="flex-row items-center gap-2 mb-2">
                  <View className="flex-row gap-1 flex-1">
                    {MODES.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setSplits((prev) => prev.map((s, i) => i === idx ? { ...s, mode: m.key } : s))}
                        className={`px-2 py-1 rounded-lg ${sp.mode === m.key ? 'bg-amber-500' : 'bg-gray-100'}`}
                      >
                        <Text className={`text-xs font-medium ${sp.mode === m.key ? 'text-white' : 'text-gray-600'}`}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    className="border border-gray-200 rounded-lg px-3 py-2 w-24 text-gray-800 text-sm"
                    placeholder="₹0"
                    keyboardType="numeric"
                    value={sp.amountStr}
                    onChangeText={(val) => setSplits((prev) => prev.map((s, i) => i === idx ? { ...s, amountStr: val } : s))}
                  />
                </View>
              ))}
              <TouchableOpacity onPress={autofillRemaining} className="self-start mb-1">
                <Text className="text-amber-600 text-xs">Autofill remaining</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <TouchableOpacity
            className="bg-green-500 py-4 rounded-2xl items-center"
            onPress={handleConfirm}
          >
            <Text className="text-white font-bold text-base">Confirm Payment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
