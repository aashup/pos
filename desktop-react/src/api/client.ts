import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const apiClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const serverUrl = (await AsyncStorage.getItem('serverUrl')) ?? 'http://192.168.1.1:8000';
  const token = await AsyncStorage.getItem('token');
  config.baseURL = `${serverUrl}/api/v1`;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    return Promise.reject(err);
  },
);
