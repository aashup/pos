import { api } from './client'
import type { ItemVariant } from '../types'

export const itemVariantsApi = {
  listByItem(itemId: string) {
    return api.get<{ data: ItemVariant[] }>(`/item-variants`, { params: { item_id: itemId } })
  },

  get(id: string) {
    return api.get<{ data: ItemVariant }>(`/item-variants/${id}`)
  },

  create(data: Omit<ItemVariant, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<{ data: ItemVariant }>('/item-variants', data)
  },

  update(id: string, data: Partial<ItemVariant>) {
    return api.patch<{ data: ItemVariant }>(`/item-variants/${id}`, data)
  },

  delete(id: string) {
    return api.delete(`/item-variants/${id}`)
  },
}
