import {apiClient} from './client';

export type RemoteCombo = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
};

export const combosApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteCombo[]}>('/combos', {
      params: {per_page: 500},
    });
    return res.data.data;
  },
};
