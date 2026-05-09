import { api } from './client'
import type { Combo } from '../types'

export const combosApi = {
  list(params?: { company_id?: string; is_active?: boolean }) {
    return api.get<{ data: Combo[] }>('/combos', { params })
  },

  get(id: string) {
    return api.get<{ data: Combo }>(`/combos/${id}`)
  },

  create(data: Omit<Combo, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<{ data: Combo }>('/combos', data)
  },

  update(id: string, data: Partial<Combo>) {
    return api.patch<{ data: Combo }>(`/combos/${id}`, data)
  },

  delete(id: string) {
    return api.delete(`/combos/${id}`)
  },
}
