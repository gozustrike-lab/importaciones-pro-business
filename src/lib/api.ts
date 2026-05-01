// ── API helpers for ImportHub Perú ──
import type {
  DashboardStats,
  Product,
  ProductFormData,
  Client,
  ClientFormData,
  Sale,
  SaleFormData,
  ProfitAnalytics,
  TaxCalculation,
  NRUSStatus,
  NRUSConfig,
  QualityCheck,
  TrackingUpdate,
} from './types';

const BASE = '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `API Error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Dashboard
export function fetchDashboardStats() {
  return apiFetch<DashboardStats>(`${BASE}/dashboard/stats`);
}

export function seedData() {
  return apiFetch<{ message: string }>(`${BASE}/seed`, { method: 'POST' });
}

// Products
export function fetchProducts(params?: { status?: string; search?: string; grade?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.grade) query.set('grade', params.grade);
  const qs = query.toString();
  return apiFetch<Product[]>(`${BASE}/products${qs ? `?${qs}` : ''}`);
}

export function fetchAvailableProducts() {
  return apiFetch<Product[]>(`${BASE}/products?available=true`);
}

export function createProduct(data: ProductFormData) {
  return apiFetch<Product>(`${BASE}/products`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: string, data: Partial<ProductFormData>) {
  return apiFetch<Product>(`${BASE}/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<{ message: string }>(`${BASE}/products/${id}`, {
    method: 'DELETE',
  });
}

// Clients (CRM)
export function fetchClients(params?: { search?: string }) {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiFetch<Client[]>(`${BASE}/clients${qs ? `?${qs}` : ''}`);
}

export function fetchClient(id: string) {
  return apiFetch<Client & { sales: Sale[] }>(`${BASE}/clients/${id}`);
}

export function createClient(data: ClientFormData) {
  return apiFetch<Client>(`${BASE}/clients`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateClient(id: string, data: Partial<ClientFormData>) {
  return apiFetch<Client>(`${BASE}/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteClient(id: string) {
  return apiFetch<{ message: string }>(`${BASE}/clients/${id}`, {
    method: 'DELETE',
  });
}

// Sales (Ventas)
export function fetchSales(params?: { status?: string; clientId?: string; month?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.clientId) query.set('clientId', params.clientId);
  if (params?.month) query.set('month', params.month);
  const qs = query.toString();
  return apiFetch<Sale[]>(`${BASE}/sales${qs ? `?${qs}` : ''}`);
}

export function createSale(data: SaleFormData) {
  return apiFetch<Sale>(`${BASE}/sales`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSaleDelivery(id: string, data: { deliveryStatus: string; deliveryDate?: string }) {
  return apiFetch<Sale>(`${BASE}/sales/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Profit Analytics
export function fetchProfitAnalytics(params?: { month?: string; year?: number }) {
  const query = new URLSearchParams();
  if (params?.month) query.set('month', params.month);
  if (params?.year) query.set('year', String(params.year));
  const qs = query.toString();
  return apiFetch<ProfitAnalytics>(`${BASE}/analytics/profit${qs ? `?${qs}` : ''}`);
}

// Tax
export function calculateTax(data: { fobUSD: number; shippingUSD: number; exchangeRate: number }) {
  return apiFetch<TaxCalculation>(`${BASE}/tax/calculate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// NRUS
export function fetchNRUSStatus() {
  return apiFetch<NRUSStatus>(`${BASE}/nrus/status`);
}

export function fetchNRUSConfig() {
  return apiFetch<NRUSConfig>(`${BASE}/nrus/config`);
}

export function updateNRUSConfig(data: NRUSConfig) {
  return apiFetch<NRUSConfig>(`${BASE}/nrus/config`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Quality
export function fetchQualityChecks(productId: string) {
  return apiFetch<QualityCheck[]>(`${BASE}/products/${productId}/quality`);
}

export function createQualityCheck(
  productId: string,
  data: {
    inspectorName: string;
    notes: string;
    checks: QualityCheck['checks'];
  }
) {
  return apiFetch<QualityCheck>(`${BASE}/products/${productId}/quality`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Tracking
export function fetchTracking(productId: string) {
  return apiFetch<TrackingUpdate[]>(`${BASE}/products/${productId}/tracking`);
}

export function addTrackingUpdate(productId: string, data: Omit<TrackingUpdate, 'id'>) {
  return apiFetch<TrackingUpdate>(`${BASE}/products/${productId}/tracking`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
