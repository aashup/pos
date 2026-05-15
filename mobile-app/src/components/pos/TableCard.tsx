import { TouchableOpacity, Text, View } from 'react-native';
import { cn } from '@/lib/utils';
import type DiningTable from '@/db/models/DiningTable';

interface Props {
  table: DiningTable;
  onPress: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  vacant: 'bg-green-50 border-green-300',
  occupied: 'bg-amber-50 border-amber-400',
  reserved: 'bg-blue-50 border-blue-300',
  cleaning: 'bg-gray-100 border-gray-300',
};

const STATUS_DOT: Record<string, string> = {
  vacant: 'bg-green-400',
  occupied: 'bg-amber-500',
  reserved: 'bg-blue-400',
  cleaning: 'bg-gray-400',
};

export function TableCard({ table, onPress }: Props) {
  const borderStyle = STATUS_STYLES[table.status] ?? 'bg-gray-50 border-gray-200';
  const dotStyle = STATUS_DOT[table.status] ?? 'bg-gray-300';

  return (
    <TouchableOpacity
      className={cn('border-2 rounded-xl p-4 m-2 w-28 h-24 items-center justify-center', borderStyle)}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View className={cn('w-2.5 h-2.5 rounded-full mb-2', dotStyle)} />
      <Text className="text-gray-800 font-semibold text-center text-sm">{table.name}</Text>
      <Text className="text-gray-400 text-xs mt-1 capitalize">{table.status}</Text>
    </TouchableOpacity>
  );
}
