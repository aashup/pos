import { View, Text, TouchableOpacity } from 'react-native';
import { updateKotStatus } from '@/src/lib/orderActions';
import type Kot from '@/src/db/models/Kot';
import type OrderLine from '@/src/db/models/OrderLine';

interface Props {
  kot: Kot;
  lines: OrderLine[];
  orderName: string;
}

const STATUS_NEXT: Record<string, { label: string; next: 'new' | 'in_progress' | 'ready' | 'served' }> = {
  new: { label: 'Start Cooking', next: 'in_progress' },
  in_progress: { label: 'Mark Ready', next: 'ready' },
  ready: { label: 'Mark Served', next: 'served' },
};

function elapsed(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  return `${mins}m ago`;
}

export function KotCard({ kot, lines, orderName }: Props) {
  const next = STATUS_NEXT[kot.status];

  return (
    <View className="bg-gray-800 rounded-2xl p-4 mb-3 mx-2" style={{ minWidth: 220 }}>
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-white font-bold text-sm" numberOfLines={1}>{orderName}</Text>
        <Text className="text-gray-400 text-xs">{elapsed(kot.createdAt)}</Text>
      </View>

      {lines.map((l) => (
        <View key={l.id} className="flex-row justify-between py-1 border-b border-gray-700">
          <Text className="text-gray-200 text-xs flex-1" numberOfLines={1}>{l.itemName}</Text>
          <Text className="text-amber-400 text-xs font-bold ml-2">×{l.quantity}</Text>
        </View>
      ))}

      {next && (
        <TouchableOpacity
          onPress={() => updateKotStatus(kot.id, next.next)}
          className="mt-3 bg-amber-500 py-2 rounded-xl items-center"
        >
          <Text className="text-white text-xs font-semibold">{next.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
