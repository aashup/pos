import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-gray-600 text-lg mb-4">Page not found</Text>
      <Link href="/(tabs)/tables" className="text-amber-600 font-semibold">
        Go to Tables
      </Link>
    </View>
  );
}
