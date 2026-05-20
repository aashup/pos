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

export type ItemPayload = Partial<RemoteItem> & {
  cgst_pct?: number | null;
  sgst_pct?: number | null;
  item_group_id?: string | null;
};

export const itemsApi = {
  list: async (params: {page?: number; per_page?: number} = {}) => {
    const res = await apiClient.get<{data: RemoteItem[]}>('/items', {params});
    return res.data.data;
  },
  create: async (data: ItemPayload) => {
    const res = await apiClient.post<{data: RemoteItem}>('/items', data);
    return res.data.data;
  },
  update: async (id: string, data: ItemPayload) => {
    const res = await apiClient.patch<{data: RemoteItem}>(`/items/${id}`, data);
    return res.data.data;
  },
};
