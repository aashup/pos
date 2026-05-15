import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AuthLayout() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Redirect href="/(tabs)/tables" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
