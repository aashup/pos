import {apiClient} from './client';

// ── Items ────────────────────────────────────────────────────────────────────

export function createItem(data: {
  name: string;
  unit?: string;
  sale_price: number;
  cgst?: number;
  sgst?: number;
  is_active?: boolean;
  sku?: string;
}) {
  return apiClient.post('/items', data);
}

export function updateItem(serverId: string, data: {
  name?: string;
  unit?: string;
  sale_price?: number;
  cgst?: number;
  sgst?: number;
  sku?: string;
}) {
  return apiClient.patch(`/items/${serverId}`, data);
}

export function deleteItem(serverId: string) {
  return apiClient.delete(`/items/${serverId}`);
}

// ── Item Variants ─────────────────────────────────────────────────────────────

export function createVariant(data: {
  item_id: string;
  name: string;
  price: number;
}) {
  return apiClient.post('/item-variants', data);
}

export function deleteVariant(serverId: string) {
  return apiClient.delete(`/item-variants/${serverId}`);
}

// ── Modifier Groups ───────────────────────────────────────────────────────────

export function createModifierGroup(data: {
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
}) {
  return apiClient.post('/modifier-groups', data);
}

export function deleteModifierGroup(serverId: string) {
  return apiClient.delete(`/modifier-groups/${serverId}`);
}

// ── Modifiers ─────────────────────────────────────────────────────────────────

export function createModifier(data: {
  modifier_group_id: string;
  name: string;
  price: number;
}) {
  return apiClient.post(`/modifier-groups/${data.modifier_group_id}/modifiers`, {
    name: data.name,
    price: data.price,
  });
}

export function deleteModifier(groupServerId: string, modServerId: string) {
  return apiClient.delete(`/modifier-groups/${groupServerId}/modifiers/${modServerId}`);
}

// ── Combos ────────────────────────────────────────────────────────────────────

export function createCombo(data: {
  name: string;
  price: number;
  is_active?: boolean;
}) {
  return apiClient.post('/combos', data);
}

export function deleteCombo(serverId: string) {
  return apiClient.delete(`/combos/${serverId}`);
}
