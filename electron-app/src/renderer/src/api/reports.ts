import api from './client'

export const reportsApi = {
  salesSummary(params: { date_from: string; date_to: string }) {
    return api.get('/reports/sales-summary', { params })
  },
  itemWise(params: { date_from: string; date_to: string }) {
    return api.get('/reports/item-wise', { params })
  },
  dayClose(params: { date: string }) {
    return api.get('/reports/day-close', { params })
  },
  gstSummary(params: { date_from: string; date_to: string }) {
    return api.get('/reports/gst-summary', { params })
  },
  paymentMode(params: { date_from: string; date_to: string }) {
    return api.get('/reports/payment-mode', { params })
  },
}
