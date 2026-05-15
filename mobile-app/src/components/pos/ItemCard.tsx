import { TouchableOpacity, Text, View } from 'react-native';
import { formatCurrency } from '@/lib/utils';
import type Item from '@/db/models/Item';

interface Props {
  item: Item;
  onPress: () => void;
}

export function ItemCard({ item, onPress }: Props) {
  return (
    <TouchableOpacity
      className="bg-white border border-gray-100 rounded-xl p-3 m-1.5 flex-1"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className="text-gray-800 font-medium text-sm leading-tight" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="text-amber-600 font-semibold mt-1">{formatCurrency(item.price)}</Text>
    </TouchableOpacity>
  );
}
