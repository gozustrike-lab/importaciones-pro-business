// ── Domain Types for ImportHub Perú ──

export type ProductStatus = 'USA' | 'En Tránsito' | 'Perú' | 'Entregado' | 'Vendido';
export type ProductGrade = 'A' | 'B' | 'C';
export type ProductCategory = 'iPad' | 'Laptop' | 'iPhone' | 'Smartwatch' | 'Accesorio' | 'Otro';
export type SaleChannel = 'MercadoLibre' | 'Tienda' | 'WhatsApp' | 'Facebook';
export type PaymentMethod = 'Efectivo' | 'Yape' | 'Transferencia' | 'MercadoPago';
export type SaleStatus = 'Completada' | 'Pendiente' | 'Cancelada';
export type DeliveryStatus = 'Pendiente' | 'En camino' | 'Entregado';

export interface Product {
  id: string;
  orderNumber: string;
  description: string;
  category: ProductCategory;
  model: string;
  color: string;
  capacity: string;
  grade: ProductGrade;
  condition: string;
  status: ProductStatus;
  supplier: string;
  serialNumber: string;
  quantity: number;

  // Logistics
  courier: string;
  trackingNumber: string;
  estimatedArrival: string;

  // Quality
  screenOk: boolean;
  touchOk: boolean;
  speakersOk: boolean;
  microphoneOk: boolean;
  wifiOk: boolean;
  bluetoothOk: boolean;
  camerasOk: boolean;
  portsOk: boolean;
  buttonsOk: boolean;
  keyboardOk: boolean;
  trackpadOk: boolean;
  chassisOk: boolean;
  batteryOk: boolean;
  chargerIncluded: boolean;
  originalBox: boolean;
  batteryCycles: number | null;

  // USD costs
  purchasePriceUSD: number;
  shippingCostUSD: number;
  advertisingCostUSD: number;
  extraCostsUSD: number;
  exchangeRate: number;

  // PEN totals (auto-calculated)
  totalCostPEN: number;
  taxesPEN: number;
  salePricePEN: number;
  suggestedPricePEN: number;
  profitPEN: number;

  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  fullName: string;
  dniRuc: string;
  celular: string;
  email: string;
  ciudad: string;
  direccion: string;
  notas: string;
  isFrequent: boolean;
  totalPurchases: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  fullName: string;
  dniRuc?: string;
  celular?: string;
  email?: string;
  ciudad?: string;
  direccion?: string;
  notas?: string;
}

export interface Sale {
  id: string;
  saleDate: string;
  saleChannel: SaleChannel;
  productId: string;
  productDescription: string;
  productModel: string;
  clientId: string;
  clientName: string;
  clientDniRuc: string;
  clientCelular: string;
  salePricePen: number;
  costAcquisitionPen: number;
  costMarketingPen: number;
  costOperativePen: number;
  netProfitPen: number;
  profitMargin: number;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  warrantyMonths: number;
  warrantyNotes: string;
  deliveryStatus: DeliveryStatus;
  deliveryDate: string;
  createdAt: string;
}

export interface SaleFormData {
  productId: string;
  clientId: string;
  salePricePen: number;
  costMarketingPen: number;
  costOperativePen: number;
  saleChannel: SaleChannel;
  paymentMethod: PaymentMethod;
  warrantyMonths?: number;
  warrantyNotes?: string;
}

export interface DashboardStats {
  totalInvested: number;
  totalRevenue: number;
  netProfit: number;
  activeProducts: number;
  totalClients: number;
  totalSales: number;
  avgTicket: number;
  productsByStatus: {
    USA: number;
    'En Tránsito': number;
    Perú: number;
    Entregado: number;
    Vendido: number;
  };
  productsByGrade: {
    A: number;
    B: number;
    C: number;
  };
  monthlyRevenue: { month: string; revenue: number; cost: number; profit: number }[];
  topSellingProducts: { name: string; quantity: number; revenue: number }[];
  salesByChannel: { channel: string; count: number; revenue: number }[];
  recentSales: Sale[];
  recentProducts: Product[];
}

export interface ProfitAnalytics {
  totalRevenue: number;
  totalCostAcquisition: number;
  totalCostLogistics: number;
  totalCostMarketing: number;
  totalCostOperative: number;
  totalCosts: number;
  netProfit: number;
  avgMargin: number;
  bestProduct: { name: string; profit: number; margin: number } | null;
  worstProduct: { name: string; profit: number; margin: number } | null;
  monthlyBreakdown: { month: string; revenue: number; costs: number; profit: number; margin: number }[];
  salesByChannel: { channel: string; revenue: number; profit: number; count: number }[];
}

export interface TaxCalculation {
  fobUSD: number;
  shippingUSD: number;
  exchangeRate: number;
  fobPEN: number;
  adValorem: number;
  baseIGV: number;
  igv: number;
  percepcion: number;
  totalTaxesUSD: number;
  totalTaxesPEN: number;
  exempt: boolean;
}

export interface NRUSStatus {
  currentMonth: string;
  currentYear: number;
  monthlySales: number;
  category1Limit: number;
  category2Limit: number;
  currentCategory: 'Cat 1' | 'Cat 2' | 'Excedido';
  alertLevel: 'normal' | 'yellow' | 'orange' | 'red';
  igvRate: number;
  adValoremRate: number;
  percepcionRate: number;
}

export interface NRUSConfig {
  category1Limit: number;
  category2Limit: number;
  igvRate: number;
  adValoremRate: number;
  percepcionRate: number;
}

export interface QualityCheck {
  id: string;
  productId: string;
  inspectorName: string;
  notes: string;
  checks: {
    screenOk: boolean;
    touchOk: boolean;
    speakersOk: boolean;
    microphoneOk: boolean;
    wifiOk: boolean;
    bluetoothOk: boolean;
    camerasOk: boolean;
    portsOk: boolean;
    buttonsOk: boolean;
    keyboardOk: boolean;
    trackpadOk: boolean;
    chassisOk: boolean;
    batteryOk: boolean;
    chargerIncluded: boolean;
    originalBox: boolean;
  };
  createdAt: string;
}

export interface TrackingUpdate {
  id: string;
  date: string;
  location: string;
  status: string;
  description: string;
}

export interface ProductFormData {
  orderNumber?: string;
  description: string;
  category: ProductCategory;
  model?: string;
  color?: string;
  capacity?: string;
  grade: ProductGrade;
  condition: string;
  status: ProductStatus;
  supplier: string;
  serialNumber?: string;
  quantity?: number;
  courier: string;
  trackingNumber: string;
  estimatedArrival: string;
  screenOk: boolean;
  touchOk: boolean;
  speakersOk: boolean;
  microphoneOk: boolean;
  wifiOk: boolean;
  bluetoothOk: boolean;
  camerasOk: boolean;
  portsOk: boolean;
  buttonsOk: boolean;
  keyboardOk: boolean;
  trackpadOk: boolean;
  chassisOk: boolean;
  batteryOk: boolean;
  chargerIncluded: boolean;
  originalBox: boolean;
  batteryCycles: number | null;
  purchasePriceUSD: number;
  shippingCostUSD: number;
  advertisingCostUSD: number;
  extraCostsUSD: number;
  exchangeRate: number;
  salePricePEN: number;
}
