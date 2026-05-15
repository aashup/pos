import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  return token ? <Redirect href="/(tabs)/tables" /> : <Redirect href="/(auth)/login" />;
}
