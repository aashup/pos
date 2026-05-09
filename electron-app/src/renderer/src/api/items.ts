import api from './client'
import type { Item, ItemGroup } from '../types'

export const itemsApi = {
  list(params?: { search?: string; item_group_id?: string; is_active?: boolean; per_page?: number }) {
    return api.get<{ data: Item[]; total: number }>('/items', { params })
  },
  groups() {
    return api.get<{ data: ItemGroup[] }>('/item-groups')
  },
}
