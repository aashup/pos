import { apiClient } from './client';

export async function updateKotStatus(
  serverKotId: string,
  status: 'new' | 'in_progress' | 'ready' | 'served',
) {
  const { data } = await apiClient.patch(`/restaurant/kots/${serverKotId}`, { status });
  return data;
}
