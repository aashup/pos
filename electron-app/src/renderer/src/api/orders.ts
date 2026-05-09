import api from './client'

export const ordersApi = {
  list(params?: { status?: string; order_type?: string; table_id?: string }) {
    return api.get('/restaurant/orders', { params })
  },
  create(data: {
    order_type: 'dine_in' | 'takeaway' | 'delivery'
    table_id?: string
    pax?: number
    notes?: string
  }) {
    return api.post('/restaurant/orders', data)
  },
  get(id: string) {
    return api.get(`/restaurant/orders/${id}`)
  },
  addLines(orderId: string, lines: AddLinePayload[]) {
    return api.post(`/restaurant/orders/${orderId}/lines`, { lines })
  },
  removeLine(orderId: string, lineId: string) {
    return api.delete(`/restaurant/orders/${orderId}/lines/${lineId}`)
  },
  sendKot(orderId: string) {
    return api.post(`/restaurant/orders/${orderId}/kot`)
  },
  checkout(orderId: string, data: CheckoutPayload) {
    return api.post(`/restaurant/orders/${orderId}/checkout`, data)
  },
  hold(orderId: string) {
    return api.post(`/restaurant/orders/${orderId}/hold`)
  },
  unhold(orderId: string) {
    return api.post(`/restaurant/orders/${orderId}/unhold`)
  },
  cancel(orderId: string) {
    return api.post(`/restaurant/orders/${orderId}/cancel`)
  },
  transferTable(orderId: string, tableId: string) {
    return api.post(`/restaurant/orders/${orderId}/transfer-table`, { table_id: tableId })
  },
  invoiceHtml(orderId: string) {
    return api.get(`/sales-invoices/${orderId}/html?template=thermal-custom`, {
      responseType: 'text',
    })
  },
}

export interface AddLinePayload {
  item_id: string
  quantity: number
  rate: number
  discount_percent?: number
  gst_rate: number
  notes?: string
}

export interface CheckoutPayload {
  payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'split'
  amount_tendered?: number
  discount_amount?: number
  notes?: string
  split_payments?: { mode: 'cash' | 'upi' | 'card' | 'credit'; amount: number; tendered?: number }[]
}
