import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { database } from '@/src/db';
import { queryClient } from '@/src/lib/queryClient';
import { initAuthStore } from '@/src/store/authStore';
import { startSyncScheduler, stopSyncScheduler } from '@/src/lib/syncEngine';
import RootNavigator from '@/navigation/RootNavigator';
import './global.css';

function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <ActivityIndicator size="large" color="#d97706" />
      <Text style={{ marginTop: 12, color: '#9ca3af', fontSize: 14 }}>Loading Zazzy POS…</Text>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAuthStore()
      .then(() => {
        startSyncScheduler();
        setReady(true);
      })
      .catch((err) => {
        console.error('App init error:', err);
        setReady(true); // still show the app even if init fails
      });

    return () => {
      stopSyncScheduler();
    };
  }, []);

  if (!ready) {
    return <LoadingView />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider database={database}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <Toast />
        </QueryClientProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
