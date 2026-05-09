import api from './client'
import type { User } from '../types'

export const authApi = {
  login(email: string, password: string, deviceName: string) {
    return api.post<{ data: { token: string; user: User } }>('/login', { email, password, device_name: deviceName })
  },
  me() {
    return api.get<{ data: User }>('/me')
  },
  logout() {
    return api.post('/logout')
  },
  testConnection(serverUrl: string) {
    return axios_plain.get(`${serverUrl}/api/v1/health`, { timeout: 5000 })
  },
}

// Plain axios without interceptors — for testing server URL before auth
import axios from 'axios'
const axios_plain = axios.create()
