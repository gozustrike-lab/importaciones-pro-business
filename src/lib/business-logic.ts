// ============================================
// BUSINESS LOGIC - eBay Import System (Peru)
// RUC: 10762026835
// ============================================

// --- Types ---

export interface TaxBreakdown {
  fob: number;
  adValoremUsd: number;
  baseIgvUsd: number;
  igvUsd: number;
  perceptionUsd: number;
  totalTaxUsd: number;
  totalTaxPen: number;
  breakdown: {
    fob: number;
    adValorem: number;
    shippingCost: number;
    freight: number; // assumed 0 unless provided
    baseIgv: number;
    igv: number;
    perception: number;
    totalTax: number;
    exchangeRate: number;
  };
}

export interface ProfitabilityResult {
  totalCostPen: number;
  profitPen: number;
  profitMargin: number;
  breakdown: {
    purchasePen: number;
    shippingPen: number;
    taxPen: number;
    advertisingPen: number;
    extraCostsPen: number;
    salePricePen: number;
  };
}

export interface NRUSResult {
  totalMonthlySalesPen: number;
  category: string;
  alertLevel: "none" | "warning" | "danger" | "exceeded";
  percentageOfThreshold: number;
  currentThreshold: number;
  message: string;
}

export interface NRUSConfigData {
  cat1Threshold: number;
  cat2Threshold: number;
  igvRate: number;
  adValoremRate: number;
  perceptionRate: number;
  fobExemption: number;
}

// --- Tax Calculation (SUNAT Peru) ---

export function calculateTaxes(
  purchasePriceUsd: number,
  shippingCostUsd: number,
  exchangeRate: number,
  freightCostUsd: number = 0,
  adValoremRate: number = 0.04,
  igvRate: number = 0.18,
  perceptionRate: number = 0.10,
  fobExemption: number = 200
): TaxBreakdown {
  const fob = purchasePriceUsd;

  // If FOB <= $200 USD, no taxes apply
  if (fob <= fobExemption) {
    return {
      fob,
      adValoremUsd: 0,
      baseIgvUsd: 0,
      igvUsd: 0,
      perceptionUsd: 0,
      totalTaxUsd: 0,
      totalTaxPen: 0,
      breakdown: {
        fob,
        adValorem: 0,
        shippingCost: shippingCostUsd,
        freight: freightCostUsd,
        baseIgv: 0,
        igv: 0,
        perception: 0,
        totalTax: 0,
        exchangeRate,
      },
    };
  }

  // Calculate Ad/Valorem
  const adValorem = fob * adValoremRate;

  // Base IGV = FOB + Ad/Valorem + Shipping + Freight
  const baseIgv = fob + adValorem + shippingCostUsd + freightCostUsd;

  // IGV = Base IGV * 18%
  const igv = baseIgv * igvRate;

  // Percepción = Base IGV * 10%
  const perception = baseIgv * perceptionRate;

  // Total Tax in USD
  const totalTax = adValorem + igv + perception;

  // Total Tax in PEN
  const totalTaxPen = totalTax * exchangeRate;

  return {
    fob,
    adValoremUsd: adValorem,
    baseIgvUsd: baseIgv,
    igvUsd: igv,
    perceptionUsd: perception,
    totalTaxUsd: totalTax,
    totalTaxPen,
    breakdown: {
      fob,
      adValorem,
      shippingCost: shippingCostUsd,
      freight: freightCostUsd,
      baseIgv,
      igv,
      perception,
      totalTax,
      exchangeRate,
    },
  };
}

// --- Profitability Calculation ---

export function calculateProfitability(product: {
  purchasePriceUsd: number;
  shippingCostUsd: number;
  advertisingCostUsd: number;
  extraCostsUsd: number;
  exchangeRate: number;
  taxAmountPen: number;
  salePricePen: number;
}): ProfitabilityResult {
  const { purchasePriceUsd, shippingCostUsd, advertisingCostUsd, extraCostsUsd, exchangeRate, taxAmountPen, salePricePen } = product;

  const purchasePen = purchasePriceUsd * exchangeRate;
  const shippingPen = shippingCostUsd * exchangeRate;
  const advertisingPen = advertisingCostUsd * exchangeRate;
  const extraCostsPen = extraCostsUsd * exchangeRate;

  const totalCostPen = purchasePen + shippingPen + taxAmountPen + advertisingPen + extraCostsPen;
  const profitPen = salePricePen - totalCostPen;
  const profitMargin = salePricePen > 0 ? (profitPen / salePricePen) * 100 : 0;

  return {
    totalCostPen: Math.round(totalCostPen * 100) / 100,
    profitPen: Math.round(profitPen * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    breakdown: {
      purchasePen: Math.round(purchasePen * 100) / 100,
      shippingPen: Math.round(shippingPen * 100) / 100,
      taxPen: Math.round(taxAmountPen * 100) / 100,
      advertisingPen: Math.round(advertisingPen * 100) / 100,
      extraCostsPen: Math.round(extraCostsPen * 100) / 100,
      salePricePen: Math.round(salePricePen * 100) / 100,
    },
  };
}

// --- NRUS Category ---

export function getNRUSCategory(
  totalMonthlySalesPen: number,
  config: NRUSConfigData
): NRUSResult {
  const { cat1Threshold, cat2Threshold } = config;

  let category: string;
  let alertLevel: "none" | "warning" | "danger" | "exceeded";
  let currentThreshold: number;
  let percentageOfThreshold: number;
  let message: string;

  if (totalMonthlySalesPen > cat2Threshold) {
    category = "Excedido";
    alertLevel = "exceeded";
    currentThreshold = cat2Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat2Threshold) * 100;
    message = `⚠️ ¡Ventas mensuales (S/ ${totalMonthlySalesPen.toFixed(2)}) exceden el límite de Categoría 2 (S/ ${cat2Threshold.toFixed(2)})! Debe cambiar de régimen tributario.`;
  } else if (totalMonthlySalesPen > cat2Threshold * 0.9) {
    category = "Cat 2";
    alertLevel = "danger";
    currentThreshold = cat2Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat2Threshold) * 100;
    message = `🔴 Ventas al ${(percentageOfThreshold).toFixed(0)}% del límite de Cat 2 (S/ ${cat2Threshold.toFixed(2)}). ¡Cuidado, se acerca al límite!`;
  } else if (totalMonthlySalesPen > cat2Threshold * 0.8) {
    category = "Cat 2";
    alertLevel = "warning";
    currentThreshold = cat2Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat2Threshold) * 100;
    message = `🟡 Ventas al ${percentageOfThreshold.toFixed(0)}% del límite de Cat 2 (S/ ${cat2Threshold.toFixed(2)}). Monitorifique sus ventas.`;
  } else if (totalMonthlySalesPen > cat1Threshold * 0.9) {
    category = "Cat 1";
    alertLevel = "danger";
    currentThreshold = cat1Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat1Threshold) * 100;
    message = `🔴 Ventas al ${percentageOfThreshold.toFixed(0)}% del límite de Cat 1 (S/ ${cat1Threshold.toFixed(2)}). ¡Cuidado, se acerca al límite!`;
  } else if (totalMonthlySalesPen > cat1Threshold * 0.8) {
    category = "Cat 1";
    alertLevel = "warning";
    currentThreshold = cat1Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat1Threshold) * 100;
    message = `🟡 Ventas al ${percentageOfThreshold.toFixed(0)}% del límite de Cat 1 (S/ ${cat1Threshold.toFixed(2)}). Monitorifique sus ventas.`;
  } else if (totalMonthlySalesPen <= cat1Threshold) {
    category = "Cat 1";
    alertLevel = "none";
    currentThreshold = cat1Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat1Threshold) * 100;
    message = `🟢 Dentro del rango de Categoría 1 (S/ ${cat1Threshold.toFixed(2)}).`;
  } else {
    category = "Cat 2";
    alertLevel = "none";
    currentThreshold = cat2Threshold;
    percentageOfThreshold = (totalMonthlySalesPen / cat2Threshold) * 100;
    message = `🟢 Dentro del rango de Categoría 2 (S/ ${cat2Threshold.toFixed(2)}).`;
  }

  return {
    totalMonthlySalesPen: Math.round(totalMonthlySalesPen * 100) / 100,
    category,
    alertLevel,
    percentageOfThreshold: Math.round(percentageOfThreshold * 100) / 100,
    currentThreshold,
    message,
  };
}

// --- Currency Formatting ---

export function formatCurrency(amount: number, currency: "USD" | "PEN" = "USD"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// --- Helper: Calculate product financials (used when creating/updating products) ---

export function calculateProductFinancials(
  purchasePriceUsd: number,
  shippingCostUsd: number,
  advertisingCostUsd: number,
  extraCostsUsd: number,
  exchangeRate: number,
  salePricePen: number,
  nrusConfig?: NRUSConfigData
): {
  taxAmountPen: number;
  adValoremPen: number;
  igvPen: number;
  perceptionPen: number;
  totalCostPen: number;
  profitPen: number;
  profitMargin: number;
} {
  const config = nrusConfig || {
    adValoremRate: 0.04,
    igvRate: 0.18,
    perceptionRate: 0.10,
    fobExemption: 200,
    cat1Threshold: 5000,
    cat2Threshold: 8000,
  };

  const taxResult = calculateTaxes(
    purchasePriceUsd,
    shippingCostUsd,
    exchangeRate,
    0,
    config.adValoremRate,
    config.igvRate,
    config.perceptionRate,
    config.fobExemption
  );

  const purchasePen = purchasePriceUsd * exchangeRate;
  const shippingPen = shippingCostUsd * exchangeRate;
  const advertisingPen = advertisingCostUsd * exchangeRate;
  const extraCostsPen = extraCostsUsd * exchangeRate;

  const totalCostPen = purchasePen + shippingPen + taxResult.totalTaxPen + advertisingPen + extraCostsPen;
  const profitPen = salePricePen - totalCostPen;
  const profitMargin = salePricePen > 0 ? (profitPen / salePricePen) * 100 : 0;

  return {
    taxAmountPen: Math.round(taxResult.totalTaxPen * 100) / 100,
    adValoremPen: Math.round(taxResult.adValoremUsd * exchangeRate * 100) / 100,
    igvPen: Math.round(taxResult.igvUsd * exchangeRate * 100) / 100,
    perceptionPen: Math.round(taxResult.perceptionUsd * exchangeRate * 100) / 100,
    totalCostPen: Math.round(totalCostPen * 100) / 100,
    profitPen: Math.round(profitPen * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
  };
}
