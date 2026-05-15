import apiClient from './client'

export interface Party {
  id: string
  name: string
  phone: string | null
  address: string | null
  type: string
}

export const partiesApi = {
  search: (query: string) =>
    apiClient
      .get<{ data: Party[] }>('/parties', {
        params: { type: 'customer', search: query, per_page: 10 },
      })
      .then((r) => r.data.data),

  create: (data: { name: string; phone?: string; address?: string }) =>
    apiClient
      .post<{ data: Party }>('/parties', {
        type: 'customer',
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
      })
      .then((r) => r.data.data),
}
