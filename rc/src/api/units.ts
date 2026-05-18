import {apiClient} from './client';

export type RemoteUnit = {
  id: string;
  value: string;
  label: string;
  status: string;
};

export const unitsApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteUnit[]}>('/units', {
      params: {status: 'active', per_page: 500},
    });
    return res.data.data;
  },
};
