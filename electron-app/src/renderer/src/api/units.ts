import api from './client'

export interface Unit {
  id: string
  value: string
  label: string
  status: string
}

export const unitsApi = {
  list() {
    return api.get<{ data: Unit[] }>('/units', { params: { per_page: 500, status: 'active' } })
  },
}
