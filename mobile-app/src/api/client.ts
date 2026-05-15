import axios from 'axios';
import { getAuthStore } from '@/store/authStore';

export const apiClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const { token, serverUrl } = getAuthStore();
  config.baseURL = `${serverUrl}/api/v1`;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      getAuthStore().logout();
    }
    return Promise.reject(err);
  },
);
