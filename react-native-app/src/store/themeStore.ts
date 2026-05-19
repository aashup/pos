import {Appearance} from 'react-native';
import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {lightTheme, darkTheme, Theme} from '@/src/theme';

const STORAGE_KEY = 'themeMode';

export type ThemeMode = 'system' | 'light' | 'dark';

const CYCLE: ThemeMode[] = ['system', 'light', 'dark'];

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return Appearance.getColorScheme() === 'dark';
}

type ThemeState = {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>(set => ({
  themeMode: 'system',
  isDark: resolveIsDark('system'),

  setThemeMode: async mode => {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
    set({themeMode: mode, isDark: resolveIsDark(mode)});
  },

  toggle: async () => {
    const current = useThemeStore.getState().themeMode;
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    await useThemeStore.getState().setThemeMode(next);
  },
}));

export async function initThemeStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const mode: ThemeMode =
      raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
    useThemeStore.setState({themeMode: mode, isDark: resolveIsDark(mode)});
  } catch {
    // use defaults
  }

  // React to OS-level theme changes when mode is 'system'
  Appearance.addChangeListener(() => {
    if (useThemeStore.getState().themeMode === 'system') {
      useThemeStore.setState({isDark: resolveIsDark('system')});
    }
  });
}

export function useTheme(): Theme {
  const isDark = useThemeStore(s => s.isDark);
  return isDark ? darkTheme : lightTheme;
}
