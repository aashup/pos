import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  serverUrl: string;
  user: { id: string; name: string; email: string } | null;
  setAuth: (token: string, user: AuthState['user'], serverUrl: string) => void;
  setServerUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  serverUrl: 'http://192.168.1.1:8000',
  user: null,

  setAuth: async (token, user, serverUrl) => {
    await AsyncStorage.multiSet([
      ['token', token],
      ['user', JSON.stringify(user)],
      ['serverUrl', serverUrl],
    ]);
    set({ token, user, serverUrl });
  },

  setServerUrl: async (url) => {
    await AsyncStorage.setItem('serverUrl', url);
    set({ serverUrl: url });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    set({ token: null, user: null });
  },
}));

// Hydrate store from AsyncStorage — call once in App.tsx before render
export async function initAuthStore(): Promise<void> {
  const [tokenEntry, userEntry, serverUrlEntry] = await AsyncStorage.multiGet([
    'token',
    'user',
    'serverUrl',
  ]);
  const token = tokenEntry[1] ?? null;
  const user = userEntry[1] ? JSON.parse(userEntry[1]) : null;
  const serverUrl = serverUrlEntry[1] ?? 'http://192.168.1.1:8000';
  useAuthStore.setState({ token, user, serverUrl });
}

// For use outside React (axios interceptors, syncEngine)
export const getAuthStore = () => useAuthStore.getState();
