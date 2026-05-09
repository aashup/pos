import api from './client'

export const tablesApi = {
  floorPlans() {
    return api.get('/floor-plans')
  },
  tables(params?: { floor_plan_id?: string }) {
    return api.get('/dining-tables', { params })
  },
  updateStatus(tableId: string, status: string) {
    return api.patch(`/dining-tables/${tableId}/status`, { status })
  },
  merge(tableId: string, sourceTableId: string) {
    return api.post(`/dining-tables/${tableId}/merge`, { source_table_id: sourceTableId })
  },
}
