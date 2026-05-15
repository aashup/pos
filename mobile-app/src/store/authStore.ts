import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'auth-store' });

interface AuthState {
  token: string | null;
  serverUrl: string;
  user: { id: string; name: string; email: string } | null;
  setAuth: (token: string, user: AuthState['user'], serverUrl: string) => void;
  setServerUrl: (url: string) => void;
  logout: () => void;
}

const readStorage = () => ({
  token: storage.getString('token') ?? null,
  serverUrl: storage.getString('serverUrl') ?? 'http://192.168.1.1:8000',
  user: (() => {
    const raw = storage.getString('user');
    return raw ? JSON.parse(raw) : null;
  })(),
});

export const useAuthStore = create<AuthState>((set) => ({
  ...readStorage(),
  setAuth: (token, user, serverUrl) => {
    storage.set('token', token);
    storage.set('user', JSON.stringify(user));
    storage.set('serverUrl', serverUrl);
    set({ token, user, serverUrl });
  },
  setServerUrl: (url) => {
    storage.set('serverUrl', url);
    set({ serverUrl: url });
  },
  logout: () => {
    storage.delete('token');
    storage.delete('user');
    set({ token: null, user: null });
  },
}));

// For use outside React (axios interceptors)
export const getAuthStore = () => useAuthStore.getState();
