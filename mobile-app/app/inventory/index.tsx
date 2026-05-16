import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

const MENU = [
  { label: 'Items', subtitle: 'Manage menu items, prices & GST', route: '/inventory/items' as const },
  { label: 'Modifier Groups', subtitle: 'Add-ons and customisations', route: '/inventory/modifiers' as const },
  { label: 'Combos', subtitle: 'Combo meals and bundles', route: '/inventory/combos' as const },
];

export default function InventoryMenuScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-amber-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Inventory</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route)}
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
