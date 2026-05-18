import {apiClient} from './client';

export type RemoteOrderLine = {
  id: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  rate: number;
  price?: number;
  notes?: string | null;
  gst_rate?: number | null;
  variant_id?: string | null;
  modifiers_total?: number;
  kot_status?: string;
  kot_id?: string | null;
};

export type RemoteOrder = {
  id: string;
  table_id?: string | null;
  table_name?: string | null;
  status: 'open' | 'held' | 'confirmed' | 'cancelled';
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  total_amount: number;
  cgst_total?: number;
  sgst_total?: number;
  discount_amount?: number;
  payment_mode?: string | null;
  amount_paid?: number | null;
  amount_tendered?: number | null;
  change_amount?: number | null;
  lines?: RemoteOrderLine[];
  created_at?: string;
  updated_at?: string;
};

export type CreateOrderPayload = {
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  table_id?: string | null;
  pax?: number;
};

export type AddLinesPayload = {
  lines: Array<{
    item_id: string;
    quantity: number;
    rate: number;
    discount_percent?: number;
    gst_rate?: number;
    notes?: string;
    item_variant_id?: string | null;
    modifiers_total?: number;
  }>;
};

export type CheckoutPayload =
  | {
      payment_mode: 'cash' | 'upi' | 'card' | 'credit';
      amount_tendered?: number;
      discount_amount?: number;
      notes?: string;
    }
  | {
      payment_mode: 'split';
      split_payments: Array<{mode: 'cash' | 'upi' | 'card' | 'credit'; amount: number}>;
      amount_tendered?: number;
      discount_amount?: number;
      notes?: string;
    };

export const ordersApi = {
  list: async (params: {status?: string; per_page?: number; page?: number} = {}) => {
    const res = await apiClient.get<{data: RemoteOrder[]}>('/restaurant/orders', {
      params: {per_page: 200, ...params},
    });
    return res.data.data;
  },
  get: async (id: string) => {
    const res = await apiClient.get<{data: RemoteOrder}>(`/restaurant/orders/${id}`);
    return res.data.data;
  },
  create: async (data: CreateOrderPayload) => {
    const res = await apiClient.post<{data: RemoteOrder}>('/restaurant/orders', data);
    return res.data.data;
  },
  addLines: async (orderId: string, data: AddLinesPayload) => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/lines`, data);
    return res.data;
  },
  generateKot: async (orderId: string) => {
    const res = await apiClient.post<{data: {id: string; kot_number?: string}}>(
      `/restaurant/orders/${orderId}/kot`,
    );
    return res.data.data;
  },
  hold: async (orderId: string) => apiClient.post(`/restaurant/orders/${orderId}/hold`),
  unhold: async (orderId: string) => apiClient.post(`/restaurant/orders/${orderId}/unhold`),
  cancel: async (orderId: string) => apiClient.post(`/restaurant/orders/${orderId}/cancel`),
  checkout: async (orderId: string, data: CheckoutPayload) => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/checkout`, data);
    return res.data;
  },
  transferTable: async (orderId: string, table_id: string) => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/transfer-table`, {
      table_id,
    });
    return res.data;
  },
};
