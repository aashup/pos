import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const apiClient = axios.create({
  timeout: 15000,
  headers: {Accept: 'application/json'},
});

// Inject token + serverUrl from AsyncStorage on every request
apiClient.interceptors.request.use(async config => {
  const [serverUrl, token] = await Promise.all([
    AsyncStorage.getItem('serverUrl'),
    AsyncStorage.getItem('token'),
  ]);
  if (serverUrl) {
    config.baseURL = `${serverUrl.replace(/\/+$/, '')}/api/v1`;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
