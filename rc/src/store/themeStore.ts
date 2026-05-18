import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {lightTheme, darkTheme, Theme} from '@/src/theme';

const STORAGE_KEY = 'theme';

type ThemeState = {
  isDark: boolean;
  toggle: () => Promise<void>;
  setDark: (value: boolean) => Promise<void>;
};

export const useThemeStore = create<ThemeState>(set => ({
  isDark: false,

  toggle: async () => {
    const next = !useThemeStore.getState().isDark;
    await AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    set({isDark: next});
  },

  setDark: async value => {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    set({isDark: value});
  },
}));

export async function initThemeStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    useThemeStore.setState({isDark: raw === 'dark'});
  } catch {
    // use default (light)
  }
}

export function useTheme(): Theme {
  const isDark = useThemeStore(s => s.isDark);
  return isDark ? darkTheme : lightTheme;
}
