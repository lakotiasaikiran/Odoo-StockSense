import { Product, ProductCategory, Warehouse, Location, StockMove, DashboardStats, LowStockItem, StockItem } from './types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('stocksense_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  signup: (payload: { name: string; email: string; password: string }) =>
    request<{ ok: boolean; message: string; email: string; otpCode: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyOtp: (payload: { email: string; otp_code: string }) =>
    request<{ ok: boolean; message: string; token: string; user: any }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resendOtp: (email: string) =>
    request<{ ok: boolean; message: string; otpCode: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ ok: boolean; message: string; token?: string; user?: any; requireOtp?: boolean; email?: string; otpCode?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () => request<{ ok: boolean; user: any }>('/auth/me'),

  // Health
  getHealth: () => request<{ ok: boolean; database: string; service: string; time: string }>('/health'),

  // Products
  getProducts: () => request<Product[]>('/products'),
  createProduct: (payload: {
    sku: string;
    name: string;
    category_id?: number | null;
    unit_of_measure?: string;
    cost_per_unit: number;
    reorder_point?: number;
    initial_stock?: number;
    location_id?: number;
  }) => request<Product>('/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: number, payload: Partial<Product>) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProduct: (id: number) => request<{ ok: boolean; message: string }>(`/products/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request<ProductCategory[]>('/categories'),
  createCategory: (name: string) => request<ProductCategory>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),

  // Warehouses
  getWarehouses: () => request<Warehouse[]>('/warehouses'),
  createWarehouse: (payload: { name: string; short_code: string; address?: string }) =>
    request<Warehouse>('/warehouses', { method: 'POST', body: JSON.stringify(payload) }),
  updateWarehouse: (id: number, payload: { name: string; short_code: string; address?: string }) =>
    request<Warehouse>(`/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteWarehouse: (id: number) => request<{ ok: boolean }>(`/warehouses/${id}`, { method: 'DELETE' }),

  // Locations
  getLocations: (params?: { warehouse_id?: number; is_virtual?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.warehouse_id) query.append('warehouse_id', params.warehouse_id.toString());
    if (params?.is_virtual !== undefined) query.append('is_virtual', params.is_virtual.toString());
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<Location[]>(`/locations${qs}`);
  },
  createLocation: (payload: { warehouse_id: number; name: string; short_code: string; is_virtual?: boolean }) =>
    request<Location>('/locations', { method: 'POST', body: JSON.stringify(payload) }),
  deleteLocation: (id: number) => request<{ ok: boolean }>(`/locations/${id}`, { method: 'DELETE' }),

  // Receipts
  getReceipts: () => request<StockMove[]>('/receipts'),
  createReceipt: (payload: {
    warehouse_id?: number;
    source_location_id?: number;
    dest_location_id: number;
    contact?: string;
    scheduled_date: string;
    lines: { product_id: number; quantity: number }[];
  }) => request<StockMove>('/receipts', { method: 'POST', body: JSON.stringify(payload) }),
  validateReceipt: (id: number) =>
    request<{ ok: boolean; message: string; move: StockMove }>(`/receipts/${id}/validate`, { method: 'PATCH' }),
  cancelReceipt: (id: number) =>
    request<{ ok: boolean; message: string; move: StockMove }>(`/receipts/${id}/cancel`, { method: 'PATCH' }),

  // Deliveries
  getDeliveries: () => request<StockMove[]>('/deliveries'),
  createDelivery: (payload: {
    warehouse_id?: number;
    source_location_id: number;
    dest_location_id?: number;
    contact?: string;
    scheduled_date: string;
    lines: { product_id: number; quantity: number }[];
  }) => request<StockMove>('/deliveries', { method: 'POST', body: JSON.stringify(payload) }),
  validateDelivery: (id: number) =>
    request<{ ok: boolean; message: string; move: StockMove }>(`/deliveries/${id}/validate`, { method: 'PATCH' }),
  cancelDelivery: (id: number) =>
    request<{ ok: boolean; message: string; move: StockMove }>(`/deliveries/${id}/cancel`, { method: 'PATCH' }),

  // Dashboard
  getDashboard: () => request<{ dashboard: DashboardStats; lowStock: LowStockItem[]; moves: any[] }>('/dashboard'),

  // Move History
  getMoves: (params?: { status?: string; type?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<StockMove[]>(`/moves${qs}`);
  },

  // Stock & Adjustments
  getStock: () => request<StockItem[]>('/stock'),
  createAdjustment: (payload: { product_id: number; location_id: number; new_quantity: number; reason?: string }) =>
    request<{ ok: boolean; message: string; move: any }>('/adjustments', { method: 'POST', body: JSON.stringify(payload) }),
};
