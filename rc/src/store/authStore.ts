import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {authApi, LoginUser} from '@/src/api/auth';

type AuthState = {
  ready: boolean;
  token: string | null;
  serverUrl: string | null;
  user: LoginUser | null;
  setReady: (ready: boolean) => void;
  setServerUrl: (url: string) => Promise<void>;
  setToken: (token: string | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>(set => ({
  ready: false,
  token: null,
  serverUrl: null,
  user: null,
  setReady: ready => set({ready}),
  setServerUrl: async url => {
    if (url) {
      await AsyncStorage.setItem('serverUrl', url);
    } else {
      await AsyncStorage.removeItem('serverUrl');
    }
    set({serverUrl: url || null});
  },
  setToken: async token => {
    if (token) {
      await AsyncStorage.setItem('token', token);
    } else {
      await AsyncStorage.removeItem('token');
    }
    set({token});
  },
  login: async (email, password) => {
    const {token, user} = await authApi.login(email, password);
    await AsyncStorage.multiSet([
      ['token', token],
      ['user', JSON.stringify(user)],
    ]);
    set({token, user});
  },
  logout: async () => {
    await authApi.logout();
    await AsyncStorage.multiRemove(['token', 'user']);
    set({token: null, user: null});
  },
}));

export async function initAuthStore(): Promise<void> {
  const [serverUrl, token, userJson] = await Promise.all([
    AsyncStorage.getItem('serverUrl'),
    AsyncStorage.getItem('token'),
    AsyncStorage.getItem('user'),
  ]);
  let user: LoginUser | null = null;
  try {
    user = userJson ? (JSON.parse(userJson) as LoginUser) : null;
  } catch {
    user = null;
  }
  useAuthStore.setState({serverUrl, token, user, ready: true});
}
