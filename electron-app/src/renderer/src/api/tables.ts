import api from './client'

export const tablesApi = {
  // Floor plans
  floorPlans() {
    return api.get('/floor-plans')
  },
  createFloorPlan(data: { name: string; sort_order?: number }) {
    return api.post('/floor-plans', data)
  },
  updateFloorPlan(id: string, data: { name: string; sort_order?: number }) {
    return api.put(`/floor-plans/${id}`, data)
  },
  deleteFloorPlan(id: string) {
    return api.delete(`/floor-plans/${id}`)
  },

  // Dining tables
  tables(params?: { floor_plan_id?: string }) {
    return api.get('/dining-tables', { params })
  },
  createTable(data: {
    floor_plan_id: string
    name: string
    capacity?: number
    shape?: 'square' | 'round' | 'rectangle'
    pos_x?: number
    pos_y?: number
  }) {
    return api.post('/dining-tables', data)
  },
  updateTable(id: string, data: {
    name?: string
    capacity?: number
    shape?: 'square' | 'round' | 'rectangle'
    pos_x?: number
    pos_y?: number
    is_active?: boolean
  }) {
    return api.put(`/dining-tables/${id}`, data)
  },
  deleteTable(id: string) {
    return api.delete(`/dining-tables/${id}`)
  },
  updateStatus(tableId: string, status: string) {
    return api.patch(`/dining-tables/${tableId}/status`, { status })
  },
  merge(tableId: string, sourceTableId: string) {
    return api.post(`/dining-tables/${tableId}/merge`, { source_table_id: sourceTableId })
  },
}
