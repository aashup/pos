import {apiClient} from './client';

export type RemoteModifier = {
  id: string;
  modifier_group_id: string;
  name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
};

export type RemoteModifierGroup = {
  id: string;
  name: string;
  item_id?: string | null;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  modifiers?: RemoteModifier[];
};

export const modifierGroupsApi = {
  list: async () => {
    const res = await apiClient.get<{data: RemoteModifierGroup[]}>(
      '/modifier-groups',
      {params: {per_page: 500}},
    );
    return res.data.data;
  },
  // Junction table — links item_id to modifier_group_id
  listItemLinks: async () => {
    const res = await apiClient.get<{data: Array<{item_id: string; modifier_group_id: string}>}>(
      '/item-modifier-groups',
      {params: {per_page: 1000}},
    );
    return res.data.data;
  },
};
