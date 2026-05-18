import {apiClient} from './client';

export type LoginUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

export type LoginResponse = {
  data: {
    user: LoginUser;
    token: string;
  };
};

export const authApi = {
  login: async (email: string, password: string, deviceName = 'rc-android') => {
    const res = await apiClient.post<LoginResponse>('/login', {
      email,
      password,
      device_name: deviceName,
    });
    return res.data.data;
  },
  logout: async () => {
    try {
      await apiClient.post('/logout');
    } catch {
      // ignore — local logout is the source of truth
    }
  },
  me: async () => {
    const res = await apiClient.get<{data: LoginUser}>('/me');
    return res.data.data;
  },
};
