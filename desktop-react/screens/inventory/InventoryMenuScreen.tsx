import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const MENU = [
  { label: 'Items', subtitle: 'Manage menu items, prices & GST', screen: 'InventoryItems' as const },
  { label: 'Modifier Groups', subtitle: 'Add-ons and customisations', screen: 'InventoryModifiers' as const },
  { label: 'Combos', subtitle: 'Combo meals and bundles', screen: 'InventoryCombos' as const },
];

export default function InventoryMenuScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-4 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Inventory</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.screen}
            onPress={() => navigation.navigate(item.screen)}
            className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-gray-800 font-semibold text-base">{item.label}</Text>
              <Text className="text-gray-400 text-sm mt-0.5">{item.subtitle}</Text>
            </View>
            <Text className="text-amber-500 text-lg">›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
