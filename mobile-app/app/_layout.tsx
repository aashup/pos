import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { database } from '@/db';
import { queryClient } from '@/lib/queryClient';
import { startSyncScheduler, stopSyncScheduler } from '@/lib/syncEngine';

export default function RootLayout() {
  useEffect(() => {
    startSyncScheduler();
    return () => stopSyncScheduler();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <DatabaseProvider database={database}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="reports/sales" />
            <Stack.Screen name="reports/day-close" />
            <Stack.Screen name="reports/item-wise" />
            <Stack.Screen name="reports/gst" />
            <Stack.Screen name="inventory/index" />
            <Stack.Screen name="inventory/items" />
            <Stack.Screen name="inventory/item/[id]" />
            <Stack.Screen name="inventory/modifiers" />
            <Stack.Screen name="inventory/combos" />
          </Stack>
          <Toast />
        </QueryClientProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
