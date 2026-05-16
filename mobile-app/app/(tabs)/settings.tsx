import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { queryClient } from '@/lib/queryClient';
import { runAllSyncs } from '@/lib/syncEngine';

export default function SettingsScreen() {
  const { serverUrl, user, setServerUrl, logout } = useAuthStore();
  const { status, lastSyncAt, errors } = useSyncStore();
  const [editUrl, setEditUrl] = useState(serverUrl);

  const handleSaveUrl = () => {
    setServerUrl(editUrl.trim());
    queryClient.clear();
    Alert.alert('Saved', 'Server URL updated. Data will re-sync on next use.');
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const lastSyncLabel = lastSyncAt
    ? `${Math.round((Date.now() - lastSyncAt) / 60000)}m ago`
    : 'Never';

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-12 pb-3 px-4">
        <Text className="text-xl font-bold text-gray-800">Settings</Text>
      </View>

      {/* User info */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 border border-gray-100">
        <Text className="text-xs text-gray-400 uppercase tracking-wide mb-1">Signed in as</Text>
        <Text className="text-gray-800 font-semibold">{user?.name ?? '—'}</Text>
        <Text className="text-gray-500 text-sm">{user?.email ?? '—'}</Text>
      </View>

      {/* Server URL */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 border border-gray-100">
        <Text className="text-xs text-gray-400 uppercase tracking-wide mb-2">Server URL</Text>
        <TextInput
          className="border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm bg-gray-50 mb-3"
          value={editUrl}
          onChangeText={setEditUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="http://192.168.1.1:8000"
        />
        <TouchableOpacity
          className="bg-amber-500 rounded-lg py-2.5 items-center"
          onPress={handleSaveUrl}
        >
          <Text className="text-white font-semibold text-sm">Save & Re-sync</Text>
        </TouchableOpacity>
      </View>

      {/* Sync status */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 border border-gray-100">
        <Text className="text-xs text-gray-400 uppercase tracking-wide mb-2">Sync</Text>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-gray-600 text-sm">
            Status: <Text className={status === 'error' ? 'text-red-500' : status === 'syncing' ? 'text-amber-600' : 'text-green-600'}>{status}</Text>
          </Text>
          <Text className="text-gray-400 text-xs">Last: {lastSyncLabel}</Text>
        </View>
        {status === 'error' && errors.length > 0 && (
          <Text className="text-red-500 text-xs mb-2">{errors[errors.length - 1]}</Text>
        )}
        <TouchableOpacity
          className="py-2 bg-gray-50 rounded-lg items-center border border-gray-200"
          onPress={() => runAllSyncs()}
        >
          <Text className="text-amber-600 font-medium text-sm">Force Sync Now</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation: Reports */}
      <View className="bg-white mx-4 mt-4 rounded-xl border border-gray-100 overflow-hidden">
        <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Reports</Text>
        {[
          { label: 'Sales Summary', route: '/reports/sales' },
          { label: 'Day Close', route: '/reports/day-close' },
          { label: 'Item Wise', route: '/reports/item-wise' },
          { label: 'GST Report', route: '/reports/gst' },
        ].map((item, i, arr) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            className={`flex-row justify-between items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <Text className="text-gray-700">{item.label}</Text>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation: Inventory */}
      <View className="bg-white mx-4 mt-4 rounded-xl border border-gray-100 overflow-hidden">
        <Text className="text-xs text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Inventory</Text>
        {[
          { label: 'Items', route: '/inventory/items' },
          { label: 'Modifier Groups', route: '/inventory/modifiers' },
          { label: 'Combos', route: '/inventory/combos' },
        ].map((item, i, arr) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            className={`flex-row justify-between items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <Text className="text-gray-700">{item.label}</Text>
            <Text className="text-gray-400">›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign out */}
      <View className="mx-4 mt-6 mb-12">
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-xl py-4 items-center"
          onPress={handleLogout}
        >
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
