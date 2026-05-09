import api from './client'

export const kotsApi = {
  list(params?: { status?: string; since?: string }) {
    return api.get('/kots', { params })
  },
  get(id: string) {
    return api.get(`/kots/${id}`)
  },
  updateStatus(id: string, status: 'in_progress' | 'ready' | 'served') {
    return api.patch(`/kots/${id}/status`, { status })
  },
  updateLineStatus(kotId: string, lineId: string, status: 'cooking' | 'ready') {
    return api.patch(`/kots/${kotId}/lines/${lineId}/status`, { status })
  },
  reprint(id: string) {
    return api.post(`/kots/${id}/reprint`)
  },
}
