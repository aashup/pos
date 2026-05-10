import api from './client'
import type { Item, ItemGroup } from '../types'

export const itemsApi = {
  list(params?: { search?: string; item_group_id?: string; is_active?: boolean; per_page?: number }) {
    return api.get<{ data: Item[]; total: number }>('/items', { params })
  },
  groups() {
    return api.get<{ data: ItemGroup[] }>('/item-groups')
  },
  get(id: string) {
    return api.get<{ data: Item }>(`/items/${id}`)
  },
  create(data: Partial<Item>) {
    return api.post<{ data: Item }>('/items', data)
  },
  update(id: string, data: Partial<Item>) {
    return api.patch<{ data: Item }>(`/items/${id}`, data)
  },
  delete(id: string) {
    return api.delete(`/items/${id}`)
  },
}
