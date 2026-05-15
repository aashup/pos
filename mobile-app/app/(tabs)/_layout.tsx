import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { startLocationTracking, stopLocationTracking } from '@/lib/locationService';

export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    startLocationTracking();
    return () => {
      stopLocationTracking();
    };
  }, [token]);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#d97706',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e7eb' },
      }}
    >
      <Tabs.Screen name="tables" options={{ title: 'Tables', tabBarLabel: 'Tables' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing', tabBarLabel: 'Billing' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarLabel: 'Orders' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
