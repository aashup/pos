import {apiClient} from './client';

export type RemoteItem = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  unit?: string | null;
  is_active: boolean;
  updated_at?: string;
};

export const itemsApi = {
  list: async (params: {page?: number; per_page?: number} = {}) => {
    const res = await apiClient.get<{data: RemoteItem[]}>('/items', {params});
    return res.data.data;
  },
  create: async (data: Partial<RemoteItem>) => {
    const res = await apiClient.post<{data: RemoteItem}>('/items', data);
    return res.data.data;
  },
};
