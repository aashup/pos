import {apiClient} from './client';

export type RemoteFloorPlan = {
  id: string;
  name: string;
};

export type RemoteDiningTable = {
  id: string;
  floor_plan_id: string;
  name: string;
  capacity: number;
  shape: 'square' | 'round' | 'rectangle';
  pos_x: number;
  pos_y: number;
  is_active: boolean;
  status: 'vacant' | 'occupied' | 'reserved' | 'cleaning';
  current_order_id?: string | null;
};

// ── Floor Plans ───────────────────────────────────────────────────────────────

export const floorPlansApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteFloorPlan[]}>('/floor-plans', {
      params: {per_page: 500},
    });
    return res.data.data;
  },
  create: async (payload: {name: string}) => {
    const res = await apiClient.post<{data: RemoteFloorPlan}>('/floor-plans', payload);
    return res.data.data;
  },
  update: async (id: string, payload: {name: string}) => {
    const res = await apiClient.patch<{data: RemoteFloorPlan}>(`/floor-plans/${id}`, payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(`/floor-plans/${id}`);
  },
};

// ── Dining Tables ─────────────────────────────────────────────────────────────

export const diningTablesApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteDiningTable[]}>(
      '/dining-tables',
      {params: {per_page: 500}},
    );
    return res.data.data;
  },
  create: async (payload: {
    floor_plan_id: string;
    name: string;
    capacity?: number;
    shape?: string;
    pos_x?: number;
    pos_y?: number;
  }) => {
    const res = await apiClient.post<{data: RemoteDiningTable}>('/dining-tables', payload);
    return res.data.data;
  },
  update: async (
    id: string,
    payload: Partial<{
      name: string;
      capacity: number;
      shape: string;
      pos_x: number;
      pos_y: number;
      is_active: boolean;
    }>,
  ) => {
    const res = await apiClient.patch<{data: RemoteDiningTable}>(`/dining-tables/${id}`, payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(`/dining-tables/${id}`);
  },
  updateStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/dining-tables/${id}/status`, {status});
    return res.data;
  },
};
