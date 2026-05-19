import {apiClient} from './client';

export type RemoteKot = {
  id: string;
  order_id: string;
  status: 'new' | 'in_progress' | 'ready' | 'served';
  created_at?: string;
};

export const kotsApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteKot[]}>('/kots', {
      params: {per_page: 200},
    });
    return res.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/kots/${id}/status`, {status});
    return res.data;
  },
  updateLineStatus: async (kotId: string, lineId: string, status: string) => {
    const res = await apiClient.patch(`/kots/${kotId}/lines/${lineId}/status`, {
      status,
    });
    return res.data;
  },
};
