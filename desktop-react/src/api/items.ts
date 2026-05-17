import { apiClient } from './client';

export interface ApiItem {
  id: string;
  name: string;
  sale_price: number;
  barcode?: string | null;
  item_group_id: string;
  is_active: boolean;
  cgst?: number | null;
  sgst?: number | null;
  unit?: string | null;
  sku?: string | null;
  has_variants?: number; // count from API
  has_modifiers?: number; // count from API
}

export interface ApiItemGroup {
  id: string;
  name: string;
}

export interface ApiItemVariant {
  id: string;
  item_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

export interface ApiModifier {
  id: string;
  modifier_group_id: string;
  name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
}

export interface ApiModifierGroup {
  id: string;
  name: string;
  item_id?: string | null;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  modifiers?: ApiModifier[];
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

export async function fetchItemVariants(page = 1, perPage = 200) {
  const { data } = await apiClient.get('/item-variants', {
    params: { per_page: perPage, page },
  });
  return data as { data: ApiItemVariant[]; next_page_url: string | null };
}

export async function fetchModifierGroups(page = 1, perPage = 200) {
  const { data } = await apiClient.get('/modifier-groups', {
    params: { per_page: perPage, page },
  });
  return data as { data: ApiModifierGroup[]; next_page_url: string | null };
}

export async function fetchUnits() {
  const { data } = await apiClient.get('/units', {
    params: { status: 'active', per_page: 500 },
  });
  return (data.data ?? data) as Array<{ id: string; value: string; label: string; status: string }>;
}
