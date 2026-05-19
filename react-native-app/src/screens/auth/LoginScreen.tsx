import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useAuthStore} from '@/src/store/authStore';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import {useTheme} from '@/src/store/themeStore';

export default function LoginScreen() {
  const theme = useTheme();
  const serverUrl = useAuthStore(s => s.serverUrl);
  const setServerUrl = useAuthStore(s => s.setServerUrl);
  const login = useAuthStore(s => s.login);

  const [urlInput, setUrlInput] = useState(serverUrl ?? 'http://192.168.29.40:8001');
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Aashu@123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    const url = urlInput.trim();
    if (!url) {
      setError('Server URL is required');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setSubmitting(true);
    try {
      // Persist URL first so the axios interceptor picks it up
      await setServerUrl(url);
      await login(email.trim(), password);
      // Kick off the first sync so data starts flowing immediately
      triggerSyncNow();
    } catch (err: any) {
      const msg =
        err?.response?.status === 401
          ? 'Invalid email or password'
          : err?.response?.data?.message ??
            err?.message ??
            'Login failed';
      setError(String(msg));
      Alert.alert('Login failed', String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, {backgroundColor: theme.bg}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.brand, {color: theme.textPrimary}]}>X-POS</Text>
          <Text style={[styles.subtitle, {color: theme.textSecondary}]}>Sign in to your POS</Text>

          <Text style={[styles.label, {color: theme.textSecondary}]}>Server URL</Text>
          <TextInput
            style={[styles.input, {backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.textPrimary}]}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://192.168.1.10:8001"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={[styles.label, {color: theme.textSecondary}]}>Email</Text>
          <TextInput
            style={[styles.input, {backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.textPrimary}]}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@demo.com"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={[styles.label, {color: theme.textSecondary}]}>Password</Text>
          <TextInput
            style={[styles.input, {backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.textPrimary}]}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </TouchableOpacity>
{/* 
          <Text style={[styles.hint, {color: theme.textMuted}]}>
            For Android emulator use{' '}
            <Text style={[styles.code, {color: theme.textPrimary}]}>http://10.0.2.2:PORT</Text>. For a physical
            device on the same Wi-Fi, use your host LAN IP.
          </Text> */}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  scroll: {flexGrow: 1, justifyContent: 'center', padding: 16},
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  brand: {fontSize: 32, fontWeight: '800'},
  subtitle: {fontSize: 14, marginBottom: 16},
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  btn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
  },
  btnDisabled: {opacity: 0.6},
  btnText: {color: '#fff', fontWeight: '700', fontSize: 15},
  error: {color: '#dc2626', fontSize: 13, marginTop: 8},
  hint: {fontSize: 11, marginTop: 14, lineHeight: 16},
  code: {fontFamily: 'monospace'},
});
