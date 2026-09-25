// ── Domain Types for ImportHub Perú ──

export type ProductStatus = 'USA' | 'TRANSITO_USA' | 'En Tránsito' | 'Perú' | 'Entregado' | 'Vendido';
export type ProductGrade = 'A' | 'B' | 'C';
export type ProductCategory = 'iPad' | 'Laptop' | 'iPhone' | 'Smartphone' | 'Smartwatch' | 'Accesorio' | 'Otro';
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
  shipperTracking?: string;
  shipperConfirmed?: boolean;
  estimatedArrival: string;

  // Real purchase details & eBay
  purchaseDate?: string;
  importerProfile?: 'fabio' | 'peggy' | string;
  recipientName?: string;
  ebayAccount?: string;
  notes?: string;
  itemId?: string;
  itemUrl?: string;
  orderUrl?: string;
  actualDeliveryDate?: string;
  estimatedDeliveryDate?: string;
  isArchived?: boolean;
  // Order total = purchasePriceUSD + shippingCostUSD (total real pagado en eBay)
  orderTotalUSD?: number;

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
  importerProfile?: string;
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

export interface PurchasesStats {
  today: { count: number; investedUsd: number; investedPen: number };
  thisWeek: { count: number; investedUsd: number; investedPen: number };
  thisMonth: { count: number; investedUsd: number; investedPen: number };
  total: { count: number; investedUsd: number; investedPen: number };
  byImporter: {
    fabio: { count: number; investedUsd: number; investedPen: number };
    peggy: { count: number; investedUsd: number; investedPen: number };
  };
  timeline: Array<{
    date: string;
    label: string;
    count: number;
    investedPen: number;
    investedUsd: number;
  }>;
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
    TRANSITO_USA?: number;
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
  nrus?: NRUSStatus;
  purchases?: PurchasesStats;
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

export interface NRUSRecommendation {
  target: 'fabio' | 'peggy' | 'none';
  targetName: string;
  targetRuc: string;
  severity: 'normal' | 'warning' | 'critical';
  title: string;
  description: string;
  actionBanner: string;
  fabioAvailablePen: number;
  fabioAvailableUsd: number;
  fabioConsumedPct: number;
  peggyAvailablePen: number;
  peggyAvailableUsd: number;
  peggyConsumedPct: number;
}

export interface NRUSProfileStatus {
  importerKey: 'fabio' | 'peggy';
  name: string;
  ruc: string;
  monthlyPurchasesPen: number;
  monthlyPurchasesUsd: number;
  purchasesCount: number;
  monthlySalesPen: number;
  salesCount: number;
  maxAmountPen: number;
  category: 'Cat 1' | 'Cat 2' | 'Excedido';
  monthlyQuotaPen: number;
  percentageOfLimit: number;
  alertLevel: 'normal' | 'yellow' | 'orange' | 'red';
  statusMessage: string;
  availablePurchasesPen?: number;
  availablePurchasesUsd?: number;
  availableSalesPen?: number;
  isNearLimit?: boolean;
  isExceeded?: boolean;
  guiaPagoFacil: {
    ruc: string;
    periodo: string;
    rectificatoria: boolean;
    ingresosBrutosPen: number;
    adquisicionesPen: number;
    categoria: number;
    importePagarPen: number;
  };
}

export interface NRUSStatus {
  totalMonthlySalesPen?: number;
  percentageOfThreshold?: number;
  category?: string;
  alertLevel: 'normal' | 'warning' | 'danger' | 'exceeded' | 'yellow' | 'orange' | 'red';
  currentMonth: string;
  currentYear: number;
  periodoSunat?: string;
  monthlySales: number;
  monthlyPurchases?: number;
  monthlyPurchasesUsd?: number;
  purchasesCount?: number;
  salesCount?: number;
  category1Limit: number;
  category2Limit: number;
  currentCategory: 'Cat 1' | 'Cat 2' | 'Excedido';
  message?: string;
  igvRate: number;
  adValoremRate: number;
  percepcionRate: number;
  exchangeRate?: number;
  byImporter?: {
    fabio: NRUSProfileStatus;
    peggy: NRUSProfileStatus;
  };
  recommendation?: NRUSRecommendation;
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
  shipperTracking?: string;
  shipperConfirmed?: boolean;
  estimatedArrival: string;
  actualArrival?: string;
  purchaseDate?: string;
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

// ── Suppliers (Proveedores) ──

export type SupplierCategory = 'general' | 'electronics' | 'accessories' | 'components' | 'peripherals' | 'cables' | 'packaging' | 'other';
export type SupplierLinkType = 'url' | 'excel' | 'document' | 'note';
export type SupplierLinkStatus = 'active' | 'discontinued' | 'out_of_stock';

export interface Supplier {
  id: string;
  name: string;
  website: string;
  url: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  notes: string;
  category: SupplierCategory;
  rating: number;
  isActive: boolean;
  lastSyncAt: string | null;
  totalProducts: number;
  totalOrders: number;
  totalSpentUsd: number;
  createdAt: string;
  updatedAt: string;
  // Optional counts from list endpoint
  linkCount?: number;
  productCount?: number;
}

export interface SupplierDetail extends Supplier {
  links: SupplierLink[];
  products: {
    id: string;
    description: string;
    category: string;
    grade: string;
    shippingStatus: string;
    purchasePriceUsd: number;
    salePricePen: number;
    createdAt: string;
  }[];
}

export interface SupplierFormData {
  name: string;
  website?: string;
  url?: string;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  notes?: string;
  category?: SupplierCategory;
  rating?: number;
  isActive?: boolean;
}

export interface SupplierLink {
  id: string;
  title: string;
  url: string;
  type: SupplierLinkType;
  priceUsd: number;
  pricePen: number;
  status: SupplierLinkStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierLinkFormData {
  title: string;
  url?: string;
  type?: SupplierLinkType;
  priceUsd?: number;
  pricePen?: number;
  status?: SupplierLinkStatus;
  notes?: string;
}

// ── eBay Account ──

export interface EbayAccountStatus {
  configured: boolean;
  connected: boolean;
  username?: string;
  feedbackScore?: number;
  feedbackPercentage?: string;
  lastSyncAt?: string | null;
}
