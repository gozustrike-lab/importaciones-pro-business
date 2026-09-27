import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { getSunatDeadline } from "@/lib/sunat-calendar";

const TC = 3.40;

const FABIO_RUC = '10762026835';
const PEGGY_RUC = '10091870911';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function evaluateCategory(purchasesPen: number, salesPen: number, cat1Limit = 5000, cat2Limit = 8000) {
  const maxAmount = Math.max(purchasesPen, salesPen);
  let category: 'Cat 1' | 'Cat 2' | 'Excedido' = 'Cat 1';
  let quota = 20;
  let alertLevel: 'normal' | 'yellow' | 'orange' | 'red' = 'normal';
  let message = 'Dentro del límite de Categoría 1 (hasta S/ 5,000). Cuota SUNAT: S/ 20.';

  if (maxAmount > cat2Limit) {
    category = 'Excedido';
    quota = 0;
    alertLevel = 'red';
    message = `¡ALERTA EXCEDIDO! Se ha superado el tope de S/ ${cat2Limit.toLocaleString()} (Max actual: S/ ${maxAmount.toFixed(2)}). Debes canalizar compras al otro RUC o evaluar cambio de régimen.`;
  } else if (maxAmount > cat1Limit) {
    category = 'Cat 2';
    quota = 50;
    alertLevel = maxAmount > 7000 ? 'orange' : 'yellow';
    message = `Categoría 2 (S/ 5,001 a S/ 8,000). Cuota SUNAT: S/ 50. Margen restante para no exceder: S/ ${(cat2Limit - maxAmount).toFixed(2)}.`;
  } else if (maxAmount > 4000) {
    alertLevel = 'yellow';
    message = `Próximo a pasar a Categoría 2 (S/ ${maxAmount.toFixed(2)} / S/ 5,000).`;
  }

  const pct = Math.min((maxAmount / cat2Limit) * 100, 100);

  return {
    category,
    quota,
    alertLevel,
    message,
    maxAmount,
    pct,
  };
}

// Helper to identify Peggy vs Fabio
const isPeggyRecord = (importerProfile?: string | null, recipientName?: string | null) => {
  const imp = (importerProfile || "").toLowerCase();
  const rec = (recipientName || "").toLowerCase();
  return imp === "peggy" || rec.includes("peggy") || rec.includes("liliana") || rec.includes("orduna") || rec.includes("orduña");
};

/**
 * Suggest a safe declared sales figure for SUNAT:
 * Adds a ~20% healthy commercial margin over purchases, ensuring it never crosses
 * from Cat 1 into Cat 2 unnecessarily (unless purchases already require Cat 2).
 */
function suggestSafeSales(purchasesPen: number, cat1Limit = 5000, cat2Limit = 8000): number {
  if (purchasesPen <= 0) return 0;
  if (purchasesPen <= cat1Limit) {
    // Keep safely inside Cat 1
    const suggested = Math.round(purchasesPen * 1.15);
    return Math.min(suggested, cat1Limit - 100);
  } else if (purchasesPen <= cat2Limit) {
    // Keep safely inside Cat 2
    const suggested = Math.round(purchasesPen * 1.12);
    return Math.min(suggested, cat2Limit - 100);
  } else {
    // Already exceeded
    return Math.round(purchasesPen);
  }
}

// GET /api/nrus/status - Get NRUS status with Bi-RUC sync & Full Annual History
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const requestedMonth = searchParams.get("month"); // e.g. "2025-11" or "2026-09"

    let nrusConfig = await db.nRUSConfig.findFirst({ where: tenantFilter });
    if (!nrusConfig && currentUser.tenantId) {
      nrusConfig = await db.nRUSConfig.create({
        data: {
          ruc: FABIO_RUC,
          businessName: "Importaciones Perú",
          cat1Threshold: 5000,
          cat2Threshold: 8000,
          igvRate: 0.18,
          adValoremRate: 0.04,
          perceptionRate: 0.10,
          fobExemption: 200,
          tenantId: currentUser.tenantId,
        },
      });
    }

    const cat1Limit = nrusConfig?.cat1Threshold || 5000;
    const cat2Limit = nrusConfig?.cat2Threshold || 8000;

    // 1. Fetch ALL products and monthly sales to construct full historical roadmap
    const allProducts = await db.product.findMany({
      where: tenantFilter,
      select: {
        id: true,
        purchaseDate: true,
        purchasePriceUsd: true,
        totalCostPen: true,
        importerProfile: true,
        recipientName: true,
        perceptionPen: true,
      },
    });

    const allMonthlySales = await db.monthlySales.findMany({
      where: tenantFilter,
    });

    const allSales = await db.sale.findMany({
      where: tenantFilter,
      include: {
        product: {
          select: {
            importerProfile: true,
            recipientName: true,
          },
        },
      },
    });

    // 2. Discover all distinct months with purchases or records
    const distinctMonthsSet = new Set<string>();
    allProducts.forEach((p) => {
      distinctMonthsSet.add(new Date(p.purchaseDate).toISOString().slice(0, 7));
    });
    allMonthlySales.forEach((ms) => {
      distinctMonthsSet.add(ms.month.slice(0, 7));
    });

    // Also include current month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    distinctMonthsSet.add(currentMonthKey);

    const sortedMonths = Array.from(distinctMonthsSet).sort().reverse();

    // 3. Build Annual History for all months
    const annualHistory = sortedMonths.map((mKey) => {
      const [yStr, mStr] = mKey.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const mIdx = m - 1;
      const mLabel = `${MONTH_NAMES[mIdx]} ${y}`;
      const pSunat = `${String(m).padStart(2, "0")}/${y}`;

      const prods = allProducts.filter((p) => {
        const pd = new Date(p.purchaseDate);
        return pd.getFullYear() === y && pd.getMonth() === mIdx;
      });

      const fabioProds = prods.filter((p) => !isPeggyRecord(p.importerProfile, p.recipientName));
      const peggyProds = prods.filter((p) => isPeggyRecord(p.importerProfile, p.recipientName));

      const fabioPurchasesUsd = fabioProds.reduce((s, p) => s + p.purchasePriceUsd, 0);
      const fabioPurchasesPen = fabioProds.reduce((s, p) => s + (p.totalCostPen || p.purchasePriceUsd * TC), 0);

      const peggyPurchasesUsd = peggyProds.reduce((s, p) => s + p.purchasePriceUsd, 0);
      const peggyPurchasesPen = peggyProds.reduce((s, p) => s + (p.totalCostPen || p.purchasePriceUsd * TC), 0);

      // Check registered sales in MonthlySales
      const msFabio = allMonthlySales.find((ms) => ms.month === `${mKey}-fabio`);
      const msPeggy = allMonthlySales.find((ms) => ms.month === `${mKey}-peggy`);
      const msGeneral = allMonthlySales.find((ms) => ms.month === mKey);

      // Check registered sales in Sale
      const monthSalesFabio = allSales.filter((s) => {
        const sd = new Date(s.saleDate);
        return sd.getFullYear() === y && sd.getMonth() === mIdx && !isPeggyRecord(s.product?.importerProfile, s.product?.recipientName);
      }).reduce((s, sl) => s + sl.salePricePen, 0);

      const monthSalesPeggy = allSales.filter((s) => {
        const sd = new Date(s.saleDate);
        return sd.getFullYear() === y && sd.getMonth() === mIdx && isPeggyRecord(s.product?.importerProfile, s.product?.recipientName);
      }).reduce((s, sl) => s + sl.salePricePen, 0);

      const fabioSalesPen = msFabio?.totalSalesPen ?? (monthSalesFabio > 0 ? monthSalesFabio : (msGeneral ? msGeneral.totalSalesPen * 0.6 : suggestSafeSales(fabioPurchasesPen, cat1Limit, cat2Limit)));
      const peggySalesPen = msPeggy?.totalSalesPen ?? (monthSalesPeggy > 0 ? monthSalesPeggy : (msGeneral ? msGeneral.totalSalesPen * 0.4 : suggestSafeSales(peggyPurchasesPen, cat1Limit, cat2Limit)));

      const fabioEval = evaluateCategory(fabioPurchasesPen, fabioSalesPen, cat1Limit, cat2Limit);
      const peggyEval = evaluateCategory(peggyPurchasesPen, peggySalesPen, cat1Limit, cat2Limit);

      const fabioDeadline = getSunatDeadline(y, m, FABIO_RUC);
      const peggyDeadline = getSunatDeadline(y, m, PEGGY_RUC);

      return {
        monthKey: mKey,
        periodoSunat: pSunat,
        monthLabel: mLabel,
        year: y,
        totalPurchasesPen: Math.round((fabioPurchasesPen + peggyPurchasesPen) * 100) / 100,
        totalPurchasesUsd: Math.round((fabioPurchasesUsd + peggyPurchasesUsd) * 100) / 100,
        totalSalesPen: Math.round((fabioSalesPen + peggySalesPen) * 100) / 100,
        purchasesCount: prods.length,
        fabio: {
          purchasesPen: Math.round(fabioPurchasesPen * 100) / 100,
          purchasesUsd: Math.round(fabioPurchasesUsd * 100) / 100,
          purchasesCount: fabioProds.length,
          salesPen: Math.round(fabioSalesPen * 100) / 100,
          category: fabioEval.category,
          quota: fabioEval.quota,
          deadlineFormatted: fabioDeadline.deadlineFormatted,
          daysRemaining: fabioDeadline.daysRemaining,
          isOverdue: fabioDeadline.isOverdue,
          status: fabioDeadline.status,
        },
        peggy: {
          purchasesPen: Math.round(peggyPurchasesPen * 100) / 100,
          purchasesUsd: Math.round(peggyPurchasesUsd * 100) / 100,
          purchasesCount: peggyProds.length,
          salesPen: Math.round(peggySalesPen * 100) / 100,
          category: peggyEval.category,
          quota: peggyEval.quota,
          deadlineFormatted: peggyDeadline.deadlineFormatted,
          daysRemaining: peggyDeadline.daysRemaining,
          isOverdue: peggyDeadline.isOverdue,
          status: peggyDeadline.status,
        },
      };
    });

    const availableMonths = sortedMonths.map((mKey) => {
      const [yStr, mStr] = mKey.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      return {
        month: mKey,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        year: y,
      };
    });

    // 4. Resolve selected month
    const targetMonthKey = requestedMonth || sortedMonths[0] || currentMonthKey;
    const [selYearStr, selMonthStr] = targetMonthKey.split("-");
    const selYear = parseInt(selYearStr, 10);
    const selMonthNum = parseInt(selMonthStr, 10);
    const selMonthIdx = selMonthNum - 1;
    const periodoSunat = `${String(selMonthNum).padStart(2, "0")}/${selYear}`;

    // Month specific data from annualHistory
    const currentHist = annualHistory.find((h) => h.monthKey === targetMonthKey) || annualHistory[0];

    const fabioPurchasesPen = currentHist.fabio.purchasesPen;
    const fabioPurchasesUsd = currentHist.fabio.purchasesUsd;
    const fabioSalesPen = currentHist.fabio.salesPen;
    const fabioEval = evaluateCategory(fabioPurchasesPen, fabioSalesPen, cat1Limit, cat2Limit);

    const peggyPurchasesPen = currentHist.peggy.purchasesPen;
    const peggyPurchasesUsd = currentHist.peggy.purchasesUsd;
    const peggySalesPen = currentHist.peggy.salesPen;
    const peggyEval = evaluateCategory(peggyPurchasesPen, peggySalesPen, cat1Limit, cat2Limit);

    const totalPurchasesPen = fabioPurchasesPen + peggyPurchasesPen;
    const totalPurchasesUsd = fabioPurchasesUsd + peggyPurchasesUsd;
    const grandTotalSalesPen = fabioSalesPen + peggySalesPen;
    const consolidatedEval = evaluateCategory(totalPurchasesPen, grandTotalSalesPen, cat1Limit, cat2Limit);

    // Limits & Balances
    const fabioAvailablePen = Math.round(Math.max(0, cat2Limit - fabioPurchasesPen) * 100) / 100;
    const fabioAvailableUsd = Math.round((fabioAvailablePen / TC) * 100) / 100;
    const fabioConsumedPct = Math.round((fabioPurchasesPen / cat2Limit) * 100);
    const fabioIsExceeded = fabioPurchasesPen > cat2Limit;
    const fabioIsNearLimit = fabioPurchasesPen >= 6000 && !fabioIsExceeded;

    const peggyAvailablePen = Math.round(Math.max(0, cat2Limit - peggyPurchasesPen) * 100) / 100;
    const peggyAvailableUsd = Math.round((peggyAvailablePen / TC) * 100) / 100;
    const peggyConsumedPct = Math.round((peggyPurchasesPen / cat2Limit) * 100);
    const peggyIsExceeded = peggyPurchasesPen > cat2Limit;
    const peggyIsNearLimit = peggyPurchasesPen >= 6000 && !peggyIsExceeded;

    // Deadlines
    const fabioDeadline = getSunatDeadline(selYear, selMonthNum, FABIO_RUC);
    const peggyDeadline = getSunatDeadline(selYear, selMonthNum, PEGGY_RUC);

    // Recommendation logic
    let target: 'fabio' | 'peggy' | 'none' = 'none';
    let targetName = '';
    let targetRuc = '';
    let severity: 'normal' | 'warning' | 'critical' = 'normal';
    let title = '';
    let description = '';
    let actionBanner = '';

    if (fabioIsExceeded && peggyIsExceeded) {
      target = 'none';
      severity = 'critical';
      title = '🚨 ALERTA CRÍTICA: Límite NRUS Alcanzado en Ambos RUCs';
      description = `Ambos titulares han superado el tope legal de compras de S/ 8,000 mensuales (Fabio: S/ ${fabioPurchasesPen.toFixed(2)} | Peggy: S/ ${peggyPurchasesPen.toFixed(2)}).`;
      actionBanner = 'DETENER compras bajo el Nuevo RUS durante este mes para evitar contingencias tributarias con SUNAT o cambio forzoso de régimen.';
    } else if (peggyIsExceeded) {
      target = 'fabio';
      targetName = 'FABIO CESAR HERRERA BONILLA';
      targetRuc = FABIO_RUC;
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Peggy Excedido de Compras';
      description = `El RUC 10091870911 (Peggy) ha superado el tope mensual de S/ 8,000 en compras (S/ ${peggyPurchasesPen.toFixed(2)} acumulados).`;
      actionBanner = `RECOMENDAMOS COMPRAR EXCLUSIVAMENTE CON EL RUC DISPONIBLE DE FABIO CÉSAR (${FABIO_RUC}). Saldo disponible: S/ ${fabioAvailablePen.toFixed(2)} ($${fabioAvailableUsd.toFixed(2)} USD).`;
    } else if (fabioIsExceeded) {
      target = 'peggy';
      targetName = 'BONILLA ORDUÑA PEGGY LILIANA';
      targetRuc = PEGGY_RUC;
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Fabio Excedido de Compras';
      description = `El RUC ${FABIO_RUC} (Fabio) ha superado el tope mensual de S/ 8,000 en compras (S/ ${fabioPurchasesPen.toFixed(2)} acumulados).`;
      actionBanner = `RECOMENDAMOS COMPRAR EXCLUSIVAMENTE CON EL RUC DISPONIBLE DE PEGGY LILIANA (${PEGGY_RUC}). Saldo disponible: S/ ${peggyAvailablePen.toFixed(2)} ($${peggyAvailableUsd.toFixed(2)} USD).`;
    } else if (peggyIsNearLimit || fabioIsNearLimit) {
      severity = 'warning';
      if (fabioAvailablePen > peggyAvailablePen) {
        target = 'fabio';
        targetName = 'FABIO CESAR HERRERA BONILLA';
        targetRuc = FABIO_RUC;
        title = '⚠️ ALERTA DE COMPRAS SUNAT: Acercándose al tope de S/ 8,000';
        description = `Peggy ha consumido el ${peggyConsumedPct}% de su tope de compras (restan S/ ${peggyAvailablePen.toFixed(2)}).`;
        actionBanner = `Recomendamos comprar preferentemente con el RUC de Fabio César (Saldo disponible: S/ ${fabioAvailablePen.toFixed(2)} / $${fabioAvailableUsd.toFixed(2)} USD).`;
      } else {
        target = 'peggy';
        targetName = 'BONILLA ORDUÑA PEGGY LILIANA';
        targetRuc = PEGGY_RUC;
        title = '⚠️ ALERTA DE COMPRAS SUNAT: Acercándose al tope de S/ 8,000';
        description = `Fabio ha consumido el ${fabioConsumedPct}% de su tope de compras (restan S/ ${fabioAvailablePen.toFixed(2)}).`;
        actionBanner = `Recomendamos comprar preferentemente con el RUC de Peggy Liliana (Saldo disponible: S/ ${peggyAvailablePen.toFixed(2)} / $${peggyAvailableUsd.toFixed(2)} USD).`;
      }
    } else {
      severity = 'normal';
      target = fabioAvailablePen >= peggyAvailablePen ? 'fabio' : 'peggy';
      targetName = target === 'fabio' ? 'FABIO CESAR HERRERA BONILLA' : 'BONILLA ORDUÑA PEGGY LILIANA';
      targetRuc = target === 'fabio' ? FABIO_RUC : PEGGY_RUC;
      title = '✅ Ambos RUCs con Saldo Disponible para Compras';
      description = `Fabio dispone de S/ ${fabioAvailablePen.toFixed(2)} ($${fabioAvailableUsd.toFixed(2)} USD) | Peggy dispone de S/ ${peggyAvailablePen.toFixed(2)} ($${peggyAvailableUsd.toFixed(2)} USD).`;
      actionBanner = `Recomendamos comprar con ${target === 'fabio' ? 'Fabio César' : 'Peggy Liliana'} para mantener balance de importaciones.`;
    }

    const recommendation = {
      target,
      targetName,
      targetRuc,
      severity,
      title,
      description,
      actionBanner,
      fabioAvailablePen,
      fabioAvailableUsd,
      fabioConsumedPct,
      peggyAvailablePen,
      peggyAvailableUsd,
      peggyConsumedPct,
    };

    const fabioProfileStatus = {
      importerKey: 'fabio' as const,
      name: 'FABIO CESAR HERRERA BONILLA',
      ruc: FABIO_RUC,
      monthlyPurchasesPen: Math.round(fabioPurchasesPen * 100) / 100,
      monthlyPurchasesUsd: Math.round(fabioPurchasesUsd * 100) / 100,
      availablePurchasesPen: fabioAvailablePen,
      availablePurchasesUsd: fabioAvailableUsd,
      isNearLimit: fabioIsNearLimit,
      isExceeded: fabioIsExceeded,
      purchasesCount: currentHist.fabio.purchasesCount,
      monthlySalesPen: Math.round(fabioSalesPen * 100) / 100,
      salesCount: 0,
      maxAmountPen: Math.round(fabioEval.maxAmount * 100) / 100,
      category: fabioEval.category,
      monthlyQuotaPen: fabioEval.quota,
      percentageOfLimit: Math.round(fabioEval.pct),
      alertLevel: fabioEval.alertLevel,
      statusMessage: fabioEval.message,
      guiaPagoFacil: {
        ruc: FABIO_RUC,
        periodo: periodoSunat,
        rectificatoria: false,
        ingresosBrutosPen: Math.round(fabioSalesPen),
        adquisicionesPen: Math.round(fabioPurchasesPen),
        categoria: fabioEval.category === 'Cat 2' ? 2 : 1,
        importePagarPen: fabioEval.quota,
        interesMoratorioPen: 0,
        compensacionPercepcionesPen: 0,
        fechaVencimiento: fabioDeadline.deadlineFormatted,
        fechaVencimientoCorta: fabioDeadline.deadlineShort,
        diasRestantes: fabioDeadline.daysRemaining,
        estadoPlazo: fabioDeadline.status,
      },
    };

    const peggyProfileStatus = {
      importerKey: 'peggy' as const,
      name: 'BONILLA ORDUÑA PEGGY LILIANA',
      ruc: PEGGY_RUC,
      monthlyPurchasesPen: Math.round(peggyPurchasesPen * 100) / 100,
      monthlyPurchasesUsd: Math.round(peggyPurchasesUsd * 100) / 100,
      availablePurchasesPen: peggyAvailablePen,
      availablePurchasesUsd: peggyAvailableUsd,
      isNearLimit: peggyIsNearLimit,
      isExceeded: peggyIsExceeded,
      purchasesCount: currentHist.peggy.purchasesCount,
      monthlySalesPen: Math.round(peggySalesPen * 100) / 100,
      salesCount: 0,
      maxAmountPen: Math.round(peggyEval.maxAmount * 100) / 100,
      category: peggyEval.category,
      monthlyQuotaPen: peggyEval.quota,
      percentageOfLimit: Math.round(peggyEval.pct),
      alertLevel: peggyEval.alertLevel,
      statusMessage: peggyEval.message,
      guiaPagoFacil: {
        ruc: PEGGY_RUC,
        periodo: periodoSunat,
        rectificatoria: false,
        ingresosBrutosPen: Math.round(peggySalesPen),
        adquisicionesPen: Math.round(peggyPurchasesPen),
        categoria: peggyEval.category === 'Cat 2' ? 2 : 1,
        importePagarPen: peggyEval.quota,
        interesMoratorioPen: 0,
        compensacionPercepcionesPen: 0,
        fechaVencimiento: peggyDeadline.deadlineFormatted,
        fechaVencimientoCorta: peggyDeadline.deadlineShort,
        diasRestantes: peggyDeadline.daysRemaining,
        estadoPlazo: peggyDeadline.status,
      },
    };

    return NextResponse.json({
      currentMonth: targetMonthKey,
      currentYear: selYear,
      periodoSunat,
      monthlySales: grandTotalSalesPen,
      monthlyPurchases: totalPurchasesPen,
      monthlyPurchasesUsd: totalPurchasesUsd,
      purchasesCount: currentHist.purchasesCount,
      salesCount: 0,
      category1Limit: cat1Limit,
      category2Limit: cat2Limit,
      currentCategory: consolidatedEval.category,
      alertLevel: consolidatedEval.alertLevel,
      percentageOfThreshold: Math.round(consolidatedEval.pct),
      message: consolidatedEval.message,
      igvRate: (nrusConfig?.igvRate || 0.18) * 100,
      adValoremRate: (nrusConfig?.adValoremRate || 0.04) * 100,
      percepcionRate: (nrusConfig?.perceptionRate || 0.10) * 100,
      exchangeRate: TC,
      byImporter: {
        fabio: fabioProfileStatus,
        peggy: peggyProfileStatus,
      },
      recommendation,
      availableMonths,
      annualHistory,
    });
  } catch (error: unknown) {
    console.error("Error fetching NRUS status:", error);
    return NextResponse.json({ error: "Error al obtener el estado NRUS" }, { status: 500 });
  }
}

// POST /api/nrus/status - Save declared sales for a specific month and profile
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { month, importerKey, declaredSalesPen, notes } = body;

    if (!month || !importerKey) {
      return NextResponse.json({ error: "Mes y RUC requeridos" }, { status: 400 });
    }

    const monthKeyWithProfile = `${month}-${importerKey}`;

    const existing = await db.monthlySales.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        month: monthKeyWithProfile,
      },
    });

    const salesAmount = parseFloat(declaredSalesPen) || 0;

    if (existing) {
      await db.monthlySales.update({
        where: { id: existing.id },
        data: {
          totalSalesPen: salesAmount,
          notes: notes || existing.notes,
        },
      });
    } else {
      await db.monthlySales.create({
        data: {
          tenantId: currentUser.tenantId,
          month: monthKeyWithProfile,
          totalSalesPen: salesAmount,
          notes: notes || `Ventas declaradas ${importerKey.toUpperCase()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Ventas declaradas actualizadas para ${importerKey.toUpperCase()}: S/ ${salesAmount.toFixed(2)}`,
    });
  } catch (error: any) {
    console.error("Error saving monthly sales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
