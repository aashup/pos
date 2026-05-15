import { apiClient } from './client';

export async function createOrder(tableServerId: string) {
  const { data } = await apiClient.post('/restaurant/orders', {
    dining_table_id: tableServerId,
    type: 'dine_in',
  });
  return data.data ?? data;
}

export async function addOrderLines(
  serverOrderId: string,
  lines: Array<{ item_id: string; quantity: number; price: number; note?: string }>,
) {
  const { data } = await apiClient.post(`/restaurant/orders/${serverOrderId}/lines`, { lines });
  return data;
}

export async function sendKot(serverOrderId: string) {
  const { data } = await apiClient.post(`/restaurant/orders/${serverOrderId}/kot`);
  return data;
}

export async function checkoutOrder(serverOrderId: string, amount: number) {
  const { data } = await apiClient.post(`/restaurant/orders/${serverOrderId}/checkout`, {
    payment_method: 'cash',
    amount_received: amount,
  });
  return data;
}

export async function holdOrder(serverOrderId: string) {
  const { data } = await apiClient.post(`/restaurant/orders/${serverOrderId}/hold`);
  return data;
}

export async function cancelOrder(serverOrderId: string) {
  const { data } = await apiClient.post(`/restaurant/orders/${serverOrderId}/cancel`);
  return data;
}

export async function fetchOrders(page = 1) {
  const { data } = await apiClient.get('/restaurant/orders', { params: { per_page: 50, page } });
  return data;
}
