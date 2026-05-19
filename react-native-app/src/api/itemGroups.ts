import {apiClient} from './client';

export type RemoteItemGroup = {
  id: string;
  name: string;
};

export const itemGroupsApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteItemGroup[]}>('/item-groups', {
      params: {per_page: 500},
    });
    return res.data.data;
  },
};
