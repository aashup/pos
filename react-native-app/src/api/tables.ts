import {apiClient} from './client';

export type RemoteFloorPlan = {
  id: string;
  name: string;
};

export type RemoteDiningTable = {
  id: string;
  floor_plan_id: string;
  name: string;
  status: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
  current_order_id?: string | null;
  is_active?: boolean;
};

export const floorPlansApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteFloorPlan[]}>('/floor-plans', {
      params: {per_page: 500},
    });
    return res.data.data;
  },
};

export const diningTablesApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteDiningTable[]}>(
      '/dining-tables',
      {params: {is_active: 1, per_page: 500}},
    );
    return res.data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/dining-tables/${id}/status`, {status});
    return res.data;
  },
};
