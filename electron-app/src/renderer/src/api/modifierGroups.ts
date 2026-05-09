import { api } from './client'
import type { ModifierGroup, Modifier } from '../types'

export const modifierGroupsApi = {
  list(params?: { company_id?: string; is_active?: boolean }) {
    return api.get<{ data: ModifierGroup[] }>('/modifier-groups', { params })
  },

  get(id: string) {
    return api.get<{ data: ModifierGroup }>(`/modifier-groups/${id}`)
  },

  create(data: Omit<ModifierGroup, 'id' | 'created_at' | 'updated_at' | 'modifiers'>) {
    return api.post<{ data: ModifierGroup }>('/modifier-groups', data)
  },

  update(id: string, data: Partial<ModifierGroup>) {
    return api.patch<{ data: ModifierGroup }>(`/modifier-groups/${id}`, data)
  },

  delete(id: string) {
    return api.delete(`/modifier-groups/${id}`)
  },

  // Nested modifiers CRUD
  createModifier(groupId: string, data: Omit<Modifier, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<{ data: Modifier }>(`/modifier-groups/${groupId}/modifiers`, data)
  },

  updateModifier(groupId: string, modifierId: string, data: Partial<Modifier>) {
    return api.patch<{ data: Modifier }>(`/modifier-groups/${groupId}/modifiers/${modifierId}`, data)
  },

  deleteModifier(groupId: string, modifierId: string) {
    return api.delete(`/modifier-groups/${groupId}/modifiers/${modifierId}`)
  },
}
