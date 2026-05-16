import { apiClient } from './client';

// ── Items ──────────────────────────────────────────────────────────────────────

export async function createItem(data: {
  name: string;
  unit: string;
  sale_price: number;
  cgst?: number;
  sgst?: number;
  is_active?: boolean;
  sku?: string;
}) {
  const { data: res } = await apiClient.post('/items', data);
  return res.data ?? res;
}

export async function updateItem(serverItemId: string, data: Partial<{
  name: string;
  unit: string;
  sale_price: number;
  cgst: number;
  sgst: number;
  is_active: boolean;
  sku: string;
}>) {
  const { data: res } = await apiClient.patch(`/items/${serverItemId}`, data);
  return res.data ?? res;
}

export async function deleteItem(serverItemId: string) {
  await apiClient.delete(`/items/${serverItemId}`);
}

// ── Variants ──────────────────────────────────────────────────────────────────

export async function createVariant(data: {
  item_id: string;
  name: string;
  price: number;
  is_active?: boolean;
}) {
  const { data: res } = await apiClient.post('/item-variants', data);
  return res.data ?? res;
}

export async function updateVariant(serverVariantId: string, data: Partial<{
  name: string;
  price: number;
  is_active: boolean;
}>) {
  const { data: res } = await apiClient.patch(`/item-variants/${serverVariantId}`, data);
  return res.data ?? res;
}

export async function deleteVariant(serverVariantId: string) {
  await apiClient.delete(`/item-variants/${serverVariantId}`);
}

// ── Modifier Groups ────────────────────────────────────────────────────────────

export async function createModifierGroup(data: {
  name: string;
  item_id?: string;
  min_selections?: number;
  max_selections?: number;
  is_required?: boolean;
}) {
  const { data: res } = await apiClient.post('/modifier-groups', data);
  return res.data ?? res;
}

export async function updateModifierGroup(serverGroupId: string, data: Partial<{
  name: string;
  item_id: string;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
}>) {
  const { data: res } = await apiClient.patch(`/modifier-groups/${serverGroupId}`, data);
  return res.data ?? res;
}

export async function deleteModifierGroup(serverGroupId: string) {
  await apiClient.delete(`/modifier-groups/${serverGroupId}`);
}

export async function createModifier(data: {
  modifier_group_id: string;
  name: string;
  price: number;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { data: res } = await apiClient.post('/modifiers', data);
  return res.data ?? res;
}

export async function updateModifier(serverModifierId: string, data: Partial<{
  name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
}>) {
  const { data: res } = await apiClient.patch(`/modifiers/${serverModifierId}`, data);
  return res.data ?? res;
}

export async function deleteModifier(serverModifierId: string) {
  await apiClient.delete(`/modifiers/${serverModifierId}`);
}

// ── Combos ─────────────────────────────────────────────────────────────────────

export async function createCombo(data: {
  name: string;
  price: number;
  is_active?: boolean;
}) {
  const { data: res } = await apiClient.post('/combos', data);
  return res.data ?? res;
}

export async function updateCombo(serverComboId: string, data: Partial<{
  name: string;
  price: number;
  is_active: boolean;
}>) {
  const { data: res } = await apiClient.patch(`/combos/${serverComboId}`, data);
  return res.data ?? res;
}

export async function deleteCombo(serverComboId: string) {
  await apiClient.delete(`/combos/${serverComboId}`);
}
