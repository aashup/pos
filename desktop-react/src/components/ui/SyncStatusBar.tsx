import { View, Text, ActivityIndicator } from 'react-native';
import { useSyncStore } from '@/src/store/syncStore';

export function SyncStatusBar() {
  const { status, lastSyncAt, errors } = useSyncStore();

  if (status === 'syncing') {
    return (
      <View className="flex-row items-center px-4 py-1.5 bg-amber-50 border-b border-amber-100">
        <ActivityIndicator size="small" color="#d97706" />
        <Text className="ml-2 text-amber-700 text-xs">Syncing…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="px-4 py-1.5 bg-red-50 border-b border-red-100">
        <Text className="text-red-600 text-xs">Sync error: {errors[errors.length - 1]}</Text>
      </View>
    );
  }

  if (!lastSyncAt) return null;

  const mins = Math.round((Date.now() - lastSyncAt) / 60000);
  const label = mins < 1 ? 'just now' : `${mins}m ago`;

  return (
    <View className="px-4 py-1 bg-gray-50 border-b border-gray-100">
      <Text className="text-gray-400 text-xs">Last sync {label}</Text>
    </View>
  );
}
