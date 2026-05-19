import 'react-native-gesture-handler';
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {initAuthStore} from '@/src/store/authStore';
import {initPrinterStore} from '@/src/store/printerStore';
import {initThemeStore, useThemeStore} from '@/src/store/themeStore';
import {startSyncScheduler} from '@/src/lib/syncEngine';
import RootNavigator from '@/src/navigation/RootNavigator';

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const isDark = useThemeStore(s => s.isDark);

  useEffect(() => {
    (async () => {
      await Promise.all([initAuthStore(), initPrinterStore(), initThemeStore()]);
      startSyncScheduler();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      style={[styles.root, {backgroundColor: isDark ? '#0f172a' : '#f8fafc'}]}>
      <SafeAreaProvider>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isDark ? 'light-content' : 'dark-content'}
        />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center'},
});

export default App;
