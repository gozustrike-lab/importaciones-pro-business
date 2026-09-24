import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

const TC = 3.40;

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

// GET /api/nrus/status - Get NRUS status with Bi-RUC sync (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const requestedMonth = searchParams.get("month"); // e.g. "2026-09"

    let nrusConfig = await db.nRUSConfig.findFirst({ where: tenantFilter });
    if (!nrusConfig && currentUser.tenantId) {
      nrusConfig = await db.nRUSConfig.create({
        data: {
          ruc: "10762026835",
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

    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth(); // 0-indexed

    if (requestedMonth && requestedMonth.includes("-")) {
      const parts = requestedMonth.split("-");
      year = parseInt(parts[0], 10) || year;
      monthIndex = (parseInt(parts[1], 10) || (monthIndex + 1)) - 1;
    }

    const currentMonthStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const periodoSunat = `${String(monthIndex + 1).padStart(2, "0")}/${year}`;

    const startOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // 1. Fetch products purchased in this month
    const monthProducts = await db.product.findMany({
      where: {
        ...tenantFilter,
        purchaseDate: { gte: startOfMonth, lte: endOfMonth },
      },
      select: {
        id: true,
        purchasePriceUsd: true,
        totalCostPen: true,
        importerProfile: true,
        recipientName: true,
        purchaseDate: true,
        description: true,
      },
    });

    // 2. Fetch sales made in this month
    const monthSales = await db.sale.findMany({
      where: {
        ...tenantFilter,
        saleDate: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        product: {
          select: {
            importerProfile: true,
            recipientName: true,
          },
        },
      },
    });

    // Helper to identify Peggy vs Fabio
    const isPeggyRecord = (importerProfile?: string | null, recipientName?: string | null) => {
      const imp = (importerProfile || "").toLowerCase();
      const rec = (recipientName || "").toLowerCase();
      return imp === "peggy" || rec.includes("peggy") || rec.includes("liliana") || rec.includes("orduna") || rec.includes("orduña");
    };

    // Calculate Fabio's Purchases
    const fabioProducts = monthProducts.filter((p) => !isPeggyRecord(p.importerProfile, p.recipientName));
    const fabioPurchasesUsd = fabioProducts.reduce((sum, p) => sum + p.purchasePriceUsd, 0);
    const fabioPurchasesPen = fabioProducts.reduce((sum, p) => sum + (p.totalCostPen || p.purchasePriceUsd * TC), 0);

    // Calculate Peggy's Purchases
    const peggyProducts = monthProducts.filter((p) => isPeggyRecord(p.importerProfile, p.recipientName));
    const peggyPurchasesUsd = peggyProducts.reduce((sum, p) => sum + p.purchasePriceUsd, 0);
    const peggyPurchasesPen = peggyProducts.reduce((sum, p) => sum + (p.totalCostPen || p.purchasePriceUsd * TC), 0);

    // Calculate Fabio's Sales
    const fabioSalesList = monthSales.filter((s) => !isPeggyRecord(s.product?.importerProfile, s.product?.recipientName));
    const fabioSalesPen = fabioSalesList.reduce((sum, s) => sum + s.salePricePen, 0);

    // Calculate Peggy's Sales
    const peggySalesList = monthSales.filter((s) => isPeggyRecord(s.product?.importerProfile, s.product?.recipientName));
    const peggySalesPen = peggySalesList.reduce((sum, s) => sum + s.salePricePen, 0);

    // Evaluations
    const fabioEval = evaluateCategory(fabioPurchasesPen, fabioSalesPen, cat1Limit, cat2Limit);
    const peggyEval = evaluateCategory(peggyPurchasesPen, peggySalesPen, cat1Limit, cat2Limit);

    // Total Consolidated
    const totalPurchasesPen = fabioPurchasesPen + peggyPurchasesPen;
    const totalPurchasesUsd = fabioPurchasesUsd + peggyPurchasesUsd;
    const totalSalesPen = fabioSalesPen + peggySalesPen;
    const totalPurchasesCount = monthProducts.length;
    const totalSalesCount = monthSales.length;

    // MonthlySales fallback / manual adjustments from DB
    const monthlySalesRecord = await db.monthlySales.findFirst({
      where: { month: currentMonthStr, ...tenantFilter },
    });
    const extraRegisteredSales = monthlySalesRecord?.totalSalesPen || 0;
    const grandTotalSalesPen = totalSalesPen + extraRegisteredSales;

    const consolidatedEval = evaluateCategory(totalPurchasesPen, grandTotalSalesPen, cat1Limit, cat2Limit);

    // Importer purchase balances and limits
    const fabioAvailablePen = Math.round((cat2Limit - fabioPurchasesPen) * 100) / 100;
    const fabioAvailableUsd = Math.round((fabioAvailablePen / TC) * 100) / 100;
    const fabioConsumedPct = Math.round((fabioPurchasesPen / cat2Limit) * 100);
    const fabioIsExceeded = fabioPurchasesPen > cat2Limit;
    const fabioIsNearLimit = fabioPurchasesPen >= 6000 && !fabioIsExceeded;

    const peggyAvailablePen = Math.round((cat2Limit - peggyPurchasesPen) * 100) / 100;
    const peggyAvailableUsd = Math.round((peggyAvailablePen / TC) * 100) / 100;
    const peggyConsumedPct = Math.round((peggyPurchasesPen / cat2Limit) * 100);
    const peggyIsExceeded = peggyPurchasesPen > cat2Limit;
    const peggyIsNearLimit = peggyPurchasesPen >= 6000 && !peggyIsExceeded;

    // Smart Purchase Recommendation Logic
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
      targetRuc = '10762026835';
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Peggy Excedido de Compras';
      description = `El RUC 10091870911 (Peggy) ha superado el tope mensual de S/ 8,000 en compras (S/ ${peggyPurchasesPen.toFixed(2)} acumulados).`;
      actionBanner = `RECOMENDAMOS COMPRAR EXCLUSIVAMENTE CON EL RUC DISPONIBLE DE FABIO CÉSAR (10762026835). Saldo disponible: S/ ${fabioAvailablePen.toFixed(2)} ($${fabioAvailableUsd.toFixed(2)} USD).`;
    } else if (fabioIsExceeded) {
      target = 'peggy';
      targetName = 'BONILLA ORDUÑA PEGGY LILIANA';
      targetRuc = '10091870911';
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Fabio Excedido de Compras';
      description = `El RUC 10762026835 (Fabio) ha superado el tope mensual de S/ 8,000 en compras (S/ ${fabioPurchasesPen.toFixed(2)} acumulados).`;
      actionBanner = `RECOMENDAMOS COMPRAR EXCLUSIVAMENTE CON EL RUC DISPONIBLE DE PEGGY LILIANA (10091870911). Saldo disponible: S/ ${peggyAvailablePen.toFixed(2)} ($${peggyAvailableUsd.toFixed(2)} USD).`;
    } else if (peggyIsNearLimit || fabioIsNearLimit) {
      severity = 'warning';
      if (fabioAvailablePen > peggyAvailablePen) {
        target = 'fabio';
        targetName = 'FABIO CESAR HERRERA BONILLA';
        targetRuc = '10762026835';
        title = '⚠️ ALERTA DE COMPRAS SUNAT: Acercándose al tope de S/ 8,000';
        description = `Peggy ha consumido el ${peggyConsumedPct}% de su tope de compras (restan S/ ${peggyAvailablePen.toFixed(2)}).`;
        actionBanner = `Recomendamos comprar preferentemente con el RUC de Fabio César (Saldo disponible: S/ ${fabioAvailablePen.toFixed(2)} / $${fabioAvailableUsd.toFixed(2)} USD).`;
      } else {
        target = 'peggy';
        targetName = 'BONILLA ORDUÑA PEGGY LILIANA';
        targetRuc = '10091870911';
        title = '⚠️ ALERTA DE COMPRAS SUNAT: Acercándose al tope de S/ 8,000';
        description = `Fabio ha consumido el ${fabioConsumedPct}% de su tope de compras (restan S/ ${fabioAvailablePen.toFixed(2)}).`;
        actionBanner = `Recomendamos comprar preferentemente con el RUC de Peggy Liliana (Saldo disponible: S/ ${peggyAvailablePen.toFixed(2)} / $${peggyAvailableUsd.toFixed(2)} USD).`;
      }
    } else {
      severity = 'normal';
      target = fabioAvailablePen >= peggyAvailablePen ? 'fabio' : 'peggy';
      targetName = target === 'fabio' ? 'FABIO CESAR HERRERA BONILLA' : 'BONILLA ORDUÑA PEGGY LILIANA';
      targetRuc = target === 'fabio' ? '10762026835' : '10091870911';
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
      ruc: '10762026835',
      monthlyPurchasesPen: Math.round(fabioPurchasesPen * 100) / 100,
      monthlyPurchasesUsd: Math.round(fabioPurchasesUsd * 100) / 100,
      availablePurchasesPen: fabioAvailablePen,
      availablePurchasesUsd: fabioAvailableUsd,
      isNearLimit: fabioIsNearLimit,
      isExceeded: fabioIsExceeded,
      purchasesCount: fabioProducts.length,
      monthlySalesPen: Math.round(fabioSalesPen * 100) / 100,
      salesCount: fabioSalesList.length,
      maxAmountPen: Math.round(fabioEval.maxAmount * 100) / 100,
      category: fabioEval.category,
      monthlyQuotaPen: fabioEval.quota,
      percentageOfLimit: Math.round(fabioEval.pct),
      alertLevel: fabioEval.alertLevel,
      statusMessage: fabioEval.message,
      guiaPagoFacil: {
        ruc: '10762026835',
        periodo: periodoSunat,
        rectificatoria: false,
        ingresosBrutosPen: Math.round(fabioSalesPen),
        adquisicionesPen: Math.round(fabioPurchasesPen),
        categoria: fabioEval.category === 'Cat 2' ? 2 : 1,
        importePagarPen: fabioEval.quota,
      },
    };

    const peggyProfileStatus = {
      importerKey: 'peggy' as const,
      name: 'BONILLA ORDUÑA PEGGY LILIANA',
      ruc: '10091870911',
      monthlyPurchasesPen: Math.round(peggyPurchasesPen * 100) / 100,
      monthlyPurchasesUsd: Math.round(peggyPurchasesUsd * 100) / 100,
      availablePurchasesPen: peggyAvailablePen,
      availablePurchasesUsd: peggyAvailableUsd,
      isNearLimit: peggyIsNearLimit,
      isExceeded: peggyIsExceeded,
      purchasesCount: peggyProducts.length,
      monthlySalesPen: Math.round(peggySalesPen * 100) / 100,
      salesCount: peggySalesList.length,
      maxAmountPen: Math.round(peggyEval.maxAmount * 100) / 100,
      category: peggyEval.category,
      monthlyQuotaPen: peggyEval.quota,
      percentageOfLimit: Math.round(peggyEval.pct),
      alertLevel: peggyEval.alertLevel,
      statusMessage: peggyEval.message,
      guiaPagoFacil: {
        ruc: '10091870911',
        periodo: periodoSunat,
        rectificatoria: false,
        ingresosBrutosPen: Math.round(peggySalesPen),
        adquisicionesPen: Math.round(peggyPurchasesPen),
        categoria: peggyEval.category === 'Cat 2' ? 2 : 1,
        importePagarPen: peggyEval.quota,
      },
    };

    return NextResponse.json({
      currentMonth: currentMonthStr,
      currentYear: year,
      periodoSunat,
      monthlySales: grandTotalSalesPen,
      monthlyPurchases: totalPurchasesPen,
      monthlyPurchasesUsd: totalPurchasesUsd,
      purchasesCount: totalPurchasesCount,
      salesCount: totalSalesCount,
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
    });
  } catch (error: unknown) {
    console.error("Error fetching NRUS status:", error);
    return NextResponse.json({ error: "Error al obtener el estado NRUS" }, { status: 500 });
  }
}
