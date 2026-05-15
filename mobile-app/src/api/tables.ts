import { apiClient } from './client';

export interface ApiFloorPlan {
  id: string;
  name: string;
  dining_tables: ApiDiningTable[];
}

export interface ApiDiningTable {
  id: string;
  name: string;
  floor_plan_id: string;
  status: string;
  current_order?: { id: string } | null;
}

export async function fetchFloorPlans() {
  const { data } = await apiClient.get('/floor-plans');
  return (data.data ?? data) as ApiFloorPlan[];
}

export async function fetchDiningTables() {
  const { data } = await apiClient.get('/dining-tables', { params: { is_active: 1 } });
  return (data.data ?? data) as ApiDiningTable[];
}
