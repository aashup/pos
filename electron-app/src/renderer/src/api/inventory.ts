import api from './client'

export const inventoryApi = {
  summary() {
    return api.get('/stock-summary')
  },
  ledger(itemId: string, params?: { page?: number }) {
    return api.get(`/stock-ledger`, { params: { item_id: itemId, ...params } })
  },
  adjust(data: { item_id: string; godown_id?: string; quantity: number; type: string; reason?: string }) {
    return api.post('/stock-ledger/adjustment', data)
  },
  reorderAlerts() {
    return api.get('/stock-ledger/reorder-alerts')
  },
}
