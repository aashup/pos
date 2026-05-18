import {apiClient} from './client';

export type RemoteItemVariant = {
  id: string;
  item_id: string;
  name: string;
  price: number;
  is_active: boolean;
};

export const itemVariantsApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteItemVariant[]}>(
      '/item-variants',
      {params: {per_page: 500}},
    );
    return res.data.data;
  },
};
