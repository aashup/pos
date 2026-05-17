import { apiClient } from './client';

export interface LoginResponse {
  user: { id: string; name: string; email: string };
  token: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post('/login', {
    email,
    password,
    device_name: 'Zazzy Mobile',
  });
  return data;
}
