import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { login } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { serverUrl, setServerUrl, setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      setAuth(res.token, res.user, serverUrl);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Login failed. Check credentials or server URL.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-3xl font-bold text-amber-600 mb-1">Zazzy Mobile</Text>
        <Text className="text-gray-500 mb-10">Restaurant POS for staff</Text>

        <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Server URL</Text>
        <TextInput
          className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-800 bg-gray-50"
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="http://192.168.1.1:8000"
        />

        <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Email</Text>
        <TextInput
          className="border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-800 bg-gray-50"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="staff@restaurant.com"
        />

        <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Password</Text>
        <TextInput
          className="border border-gray-200 rounded-lg px-4 py-3 mb-6 text-gray-800 bg-gray-50"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <TouchableOpacity
          className="bg-amber-500 rounded-lg py-4 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
