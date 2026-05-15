import { apiClient } from './client';

export interface ApiItem {
  id: string;
  name: string;
  sale_price: number;
  barcode?: string | null;
  item_group_id: string;
  is_active: boolean;
}

export interface ApiItemGroup {
  id: string;
  name: string;
}

export async function fetchItems(page = 1, perPage = 200) {
  const { data } = await apiClient.get('/items', {
    params: { per_page: perPage, page, is_active: 1 },
  });
  return data as { data: ApiItem[]; next_page_url: string | null };
}

export async function fetchItemGroups() {
  const { data } = await apiClient.get('/item-groups');
  return (data.data ?? data) as ApiItemGroup[];
}
