import React, {useEffect, useState} from 'react';
import {
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
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAuthStore} from '@/src/store/authStore';
import {useSyncStore} from '@/src/store/syncStore';
import {usePrinterStore} from '@/src/store/printerStore';
import {useTheme, useThemeStore} from '@/src/store/themeStore';
import type {ThemeMode} from '@/src/store/themeStore';
import {triggerSyncNow} from '@/src/lib/syncEngine';
import type {RootStackParamList} from '@/src/navigation/types';
import Header from '@/src/components/Header';

export default function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();

  const serverUrl = useAuthStore(s => s.serverUrl);
  const user = useAuthStore(s => s.user);
  const setServerUrl = useAuthStore(s => s.setServerUrl);
  const logout = useAuthStore(s => s.logout);

  const printerType = usePrinterStore(s => s.connectionType);
  const printerConfigured = usePrinterStore(s =>
    s.connectionType === 'system' ? true :
    s.connectionType === 'bluetooth' ? !!s.btMac :
    s.connectionType === 'network' ? !!s.netIp :
    !!s.usbVendorId,
  );

  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);

  const syncStatus = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);
  const errors = useSyncStore(s => s.errors);

  const [urlInput, setUrlInput] = useState(serverUrl ?? '');

  useEffect(() => {
    setUrlInput(serverUrl ?? '');
  }, [serverUrl]);

  async function handleSaveUrl() {
    if (!urlInput.trim()) return;
    await setServerUrl(urlInput.trim());
    Alert.alert('Saved', 'Server URL updated');
  }

  function handleLogout() {
    Alert.alert('Sign out?', 'You will need to sign in again to sync.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          logout().catch(() => {});
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header title="Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Quick nav */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, {backgroundColor: theme.surface, borderColor: theme.border}]}
            onPress={() => nav.navigate('PrinterSettings')}>
            <Text style={styles.navBtnEmoji}>🖨</Text>
            <View style={{flex: 1}}>
              <Text style={[styles.navBtnLabel, {color: theme.textPrimary}]}>Printer</Text>
              <Text style={[styles.navBtnSub, {color: theme.textSecondary}]}>
                {printerConfigured
                  ? `${printerType} · ready`
                  : 'Not configured'}
              </Text>
            </View>
            <Text style={[styles.navBtnArrow, {color: theme.textMuted}]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, {backgroundColor: theme.surface, borderColor: theme.border}]}
            onPress={() => nav.navigate('InventoryMenu')}>
            <Text style={styles.navBtnEmoji}>📦</Text>
            <Text style={[styles.navBtnLabel, {color: theme.textPrimary}]}>Inventory</Text>
            <Text style={[styles.navBtnArrow, {color: theme.textMuted}]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, {backgroundColor: theme.surface, borderColor: theme.border}]}
            onPress={() => nav.navigate('ReportsMenu')}>
            <Text style={styles.navBtnEmoji}>📊</Text>
            <Text style={[styles.navBtnLabel, {color: theme.textPrimary}]}>Reports</Text>
            <Text style={[styles.navBtnArrow, {color: theme.textMuted}]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, {backgroundColor: theme.surface, borderColor: theme.border}]}
            onPress={() => nav.navigate('TableManager')}>
            <Text style={styles.navBtnEmoji}>🪑</Text>
            <View style={{flex: 1}}>
              <Text style={[styles.navBtnLabel, {color: theme.textPrimary}]}>Tables</Text>
              <Text style={[styles.navBtnSub, {color: theme.textSecondary}]}>
                Floor plans &amp; dining tables
              </Text>
            </View>
            <Text style={[styles.navBtnArrow, {color: theme.textMuted}]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Appearance</Text>
          <View style={styles.themeRow}>
            {(
              [
                {mode: 'system', icon: '🌐', label: 'System'},
                {mode: 'light', icon: '☀', label: 'Light'},
                {mode: 'dark', icon: '☾', label: 'Dark'},
              ] as {mode: ThemeMode; icon: string; label: string}[]
            ).map(({mode, icon, label}) => {
              const active = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active ? theme.surfaceAlt : theme.surface,
                      borderColor: active ? theme.primary : theme.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                  onPress={() => setThemeMode(mode)}>
                  <Text style={styles.themeBtnIcon}>{icon}</Text>
                  <Text
                    style={[
                      styles.themeBtnLabel,
                      {
                        color: active ? theme.primary : theme.textSecondary,
                        fontWeight: active ? '700' : '400',
                      },
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Account</Text>
          {user ? (
            <>
              <Text style={[styles.userName, {color: theme.textPrimary}]}>{user.name}</Text>
              <Text style={[styles.userMeta, {color: theme.textSecondary}]}>{user.email}</Text>
              {user.role ? (
                <Text style={[styles.userMeta, {color: theme.textSecondary}]}>
                  Role: {user.role}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.help, {color: theme.textSecondary}]}>Not signed in</Text>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Server</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.textPrimary,
              },
            ]}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://192.168.1.10:8001"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
            <Text style={styles.saveBtnText}>Update URL</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, {backgroundColor: theme.surface, borderColor: theme.border}]}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Sync</Text>
          <Text style={[styles.help, {color: theme.textSecondary}]}>
            Status:{' '}
            <Text style={[styles.code, {color: theme.textPrimary}]}>{syncStatus}</Text>
            {lastSyncAt
              ? ` · last sync ${new Date(lastSyncAt).toLocaleTimeString()}`
              : ''}
          </Text>
          {errors.length > 0 && (
            <Text style={styles.error}>{errors[errors.length - 1]}</Text>
          )}
          <TouchableOpacity style={styles.syncBtn} onPress={triggerSyncNow}>
            <Text style={styles.saveBtnText}>Sync now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  scrollContent: {paddingBottom: 32},

  navRow: {flexDirection: 'row', gap: 8, margin: 12, marginBottom: 0},
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  navBtnEmoji: {fontSize: 20},
  navBtnLabel: {fontSize: 14, fontWeight: '700'},
  navBtnSub: {fontSize: 11, marginTop: 1, textTransform: 'capitalize'},
  navBtnArrow: {fontSize: 18},

  section: {
    margin: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeRow: {flexDirection: 'row', gap: 8, marginTop: 4},
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: 56,
    gap: 4,
  },
  themeBtnIcon: {fontSize: 20},
  themeBtnLabel: {fontSize: 12},
  sectionTitle: {fontSize: 13, fontWeight: '700', marginBottom: 8},
  userName: {fontSize: 16, fontWeight: '700'},
  userMeta: {fontSize: 13, marginTop: 2},
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  help: {fontSize: 12, marginTop: 6},
  code: {fontFamily: 'monospace'},
  saveBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {color: '#fff', fontWeight: '700'},
  syncBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutBtnText: {color: '#dc2626', fontWeight: '700'},
  error: {color: '#dc2626', fontSize: 12, marginTop: 6},
});
