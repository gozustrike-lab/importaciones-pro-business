import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNRUSCategory } from "@/lib/business-logic";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/dashboard/stats - Dashboard KPIs (tenant-scoped)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const capitalResult = await db.product.aggregate({
      _sum: { totalCostPen: true },
      where: tenantFilter,
    });
    const totalInvested = capitalResult._sum.totalCostPen || 0;

    const salesResult = await db.sale.aggregate({
      _sum: { salePricePen: true },
      where: { ...tenantFilter, status: "Completada" },
    });
    const totalRevenue = salesResult._sum.salePricePen || 0;

    const profitResult = await db.sale.aggregate({
      _sum: { netProfitPen: true },
      where: { ...tenantFilter, status: "Completada" },
    });
    const netProfit = profitResult._sum.netProfitPen || 0;

    const productsByStatusRaw = await db.product.groupBy({
      by: ["shippingStatus"], _count: { id: true }, where: tenantFilter,
    });
    const productsByStatus: Record<string, number> = {
      USA: 0,
      TRANSITO_USA: 0,
      "En Tránsito": 0,
      Perú: 0,
      Entregado: 0,
      Vendido: 0,
    };
    for (const item of productsByStatusRaw) {
      if (item.shippingStatus in productsByStatus) productsByStatus[item.shippingStatus] = item._count.id;
    }

    const productsByGradeRaw = await db.product.groupBy({
      by: ["grade"], _count: { id: true }, where: tenantFilter,
    });
    const productsByGrade: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (const item of productsByGradeRaw) {
      if (item.grade in productsByGrade) productsByGrade[item.grade] = item._count.id;
    }

    const activeProducts = await db.product.count({
      where: { ...tenantFilter, shippingStatus: { not: "Vendido" } },
    });
    const totalClients = await db.client.count({ where: tenantFilter });
    const totalSales = await db.sale.count({ where: { ...tenantFilter, status: "Completada" } });
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Monthly revenue chart (last 6 months)
    const now = new Date();
    const monthlyRevenueData: Array<{ month: string; revenue: number; cost: number; profit: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthSales = await db.sale.aggregate({
        _sum: { salePricePen: true, netProfitPen: true, costAcquisitionPen: true, costMarketingPen: true, costOperativePen: true },
        where: { ...tenantFilter, saleDate: { gte: startDate, lte: endDate }, status: "Completada" },
      });

      const monthLabel = monthDate.toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
      monthlyRevenueData.push({
        month: monthLabel,
        revenue: monthSales._sum.salePricePen || 0,
        cost: (monthSales._sum.costAcquisitionPen || 0) + (monthSales._sum.costMarketingPen || 0) + (monthSales._sum.costOperativePen || 0),
        profit: monthSales._sum.netProfitPen || 0,
      });
    }

    // Top selling products
    const salesWithProducts = await db.sale.findMany({
      where: { ...tenantFilter, status: "Completada" }, include: { product: true },
    });
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const s of salesWithProducts) {
      if (!productSalesMap[s.productId]) productSalesMap[s.productId] = { name: s.product.description, quantity: 0, revenue: 0 };
      productSalesMap[s.productId].quantity += 1;
      productSalesMap[s.productId].revenue += s.salePricePen;
    }
    const topSellingProducts = Object.values(productSalesMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    // Sales by channel
    const channelMap: Record<string, { channel: string; count: number; revenue: number }> = {};
    for (const s of salesWithProducts) {
      const ch = s.saleChannel || "Otro";
      if (!channelMap[ch]) channelMap[ch] = { channel: ch, count: 0, revenue: 0 };
      channelMap[ch].count += 1;
      channelMap[ch].revenue += s.salePricePen;
    }
    const salesByChannel = Object.values(channelMap);

    // Recent sales
    const recentSalesRaw = await db.sale.findMany({
      where: { ...tenantFilter, status: "Completada" },
      include: { product: true, client: true },
      orderBy: { saleDate: "desc" }, take: 5,
    });
    const recentSales = recentSalesRaw.map((s) => ({
      id: s.id, saleDate: s.saleDate.toISOString(), saleChannel: s.saleChannel,
      productId: s.productId, productDescription: s.product.description, productModel: s.product.model,
      clientId: s.clientId, clientName: s.client.fullName, clientDniRuc: s.client.dniRuc,
      clientCelular: s.client.celular, salePricePen: s.salePricePen,
      costAcquisitionPen: s.costAcquisitionPen, costMarketingPen: s.costMarketingPen,
      costOperativePen: s.costOperativePen, netProfitPen: s.netProfitPen,
      profitMargin: s.profitMargin, status: s.status, paymentMethod: s.paymentMethod,
      warrantyMonths: s.warrantyMonths, warrantyNotes: s.warrantyNotes,
      deliveryStatus: s.deliveryStatus, deliveryDate: s.deliveryDate?.toISOString() || "",
      createdAt: s.createdAt.toISOString(),
    }));

    const allProducts = await db.product.findMany({
      where: tenantFilter,
      select: {
        id: true,
        purchaseDate: true,
        createdAt: true,
        purchasePriceUsd: true,
        totalCostPen: true,
        importerProfile: true,
        recipientName: true,
        shippingStatus: true,
      },
    });

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const purchasesStats = {
      today: { count: 0, investedUsd: 0, investedPen: 0 },
      thisWeek: { count: 0, investedUsd: 0, investedPen: 0 },
      thisMonth: { count: 0, investedUsd: 0, investedPen: 0 },
      total: { count: allProducts.length, investedUsd: 0, investedPen: 0 },
      byImporter: {
        fabio: { count: 0, investedUsd: 0, investedPen: 0 },
        peggy: { count: 0, investedUsd: 0, investedPen: 0 },
      },
      timeline: [] as Array<{ date: string; label: string; count: number; investedPen: number; investedUsd: number }>,
    };

    const dailyMap: Record<string, { label: string; count: number; investedPen: number; investedUsd: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      dailyMap[key] = { label, count: 0, investedPen: 0, investedUsd: 0 };
    }

    for (const prod of allProducts) {
      const pDate = prod.purchaseDate || prod.createdAt;
      const usd = prod.purchasePriceUsd || 0;
      const pen = prod.totalCostPen || Math.round(usd * 3.40 * 100) / 100;

      purchasesStats.total.investedUsd += usd;
      purchasesStats.total.investedPen += pen;

      if (pDate >= startOfToday) {
        purchasesStats.today.count += 1;
        purchasesStats.today.investedUsd += usd;
        purchasesStats.today.investedPen += pen;
      }

      if (pDate >= startOfWeek) {
        purchasesStats.thisWeek.count += 1;
        purchasesStats.thisWeek.investedUsd += usd;
        purchasesStats.thisWeek.investedPen += pen;
      }

      if (pDate >= startOfMonthDate) {
        purchasesStats.thisMonth.count += 1;
        purchasesStats.thisMonth.investedUsd += usd;
        purchasesStats.thisMonth.investedPen += pen;
      }

      const isPeggy = (prod.importerProfile || '').toLowerCase() === 'peggy' ||
        (prod.recipientName || '').toLowerCase().includes('peggy') ||
        (prod.recipientName || '').toLowerCase().includes('orduña');

      if (isPeggy) {
        purchasesStats.byImporter.peggy.count += 1;
        purchasesStats.byImporter.peggy.investedUsd += usd;
        purchasesStats.byImporter.peggy.investedPen += pen;
      } else {
        purchasesStats.byImporter.fabio.count += 1;
        purchasesStats.byImporter.fabio.investedUsd += usd;
        purchasesStats.byImporter.fabio.investedPen += pen;
      }

      const dayKey = pDate.toISOString().slice(0, 10);
      if (dailyMap[dayKey]) {
        dailyMap[dayKey].count += 1;
        dailyMap[dayKey].investedPen += pen;
        dailyMap[dayKey].investedUsd += usd;
      }
    }

    purchasesStats.today.investedUsd = Math.round(purchasesStats.today.investedUsd * 100) / 100;
    purchasesStats.today.investedPen = Math.round(purchasesStats.today.investedPen * 100) / 100;
    purchasesStats.thisWeek.investedUsd = Math.round(purchasesStats.thisWeek.investedUsd * 100) / 100;
    purchasesStats.thisWeek.investedPen = Math.round(purchasesStats.thisWeek.investedPen * 100) / 100;
    purchasesStats.thisMonth.investedUsd = Math.round(purchasesStats.thisMonth.investedUsd * 100) / 100;
    purchasesStats.thisMonth.investedPen = Math.round(purchasesStats.thisMonth.investedPen * 100) / 100;
    purchasesStats.total.investedUsd = Math.round(purchasesStats.total.investedUsd * 100) / 100;
    purchasesStats.total.investedPen = Math.round(purchasesStats.total.investedPen * 100) / 100;
    purchasesStats.byImporter.fabio.investedUsd = Math.round(purchasesStats.byImporter.fabio.investedUsd * 100) / 100;
    purchasesStats.byImporter.fabio.investedPen = Math.round(purchasesStats.byImporter.fabio.investedPen * 100) / 100;
    purchasesStats.byImporter.peggy.investedUsd = Math.round(purchasesStats.byImporter.peggy.investedUsd * 100) / 100;
    purchasesStats.byImporter.peggy.investedPen = Math.round(purchasesStats.byImporter.peggy.investedPen * 100) / 100;

    purchasesStats.timeline = Object.entries(dailyMap).map(([date, d]) => ({
      date,
      label: d.label,
      count: d.count,
      investedPen: Math.round(d.investedPen * 100) / 100,
      investedUsd: Math.round(d.investedUsd * 100) / 100,
    }));

    const recentProducts = await db.product.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        description: true,
        shippingStatus: true,
        purchasePriceUsd: true,
        profitPen: true,
        category: true,
        grade: true,
        orderNumber: true,
        trackingId: true,
        courier: true,
        importerProfile: true,
        purchaseDate: true,
        notes: true,
        createdAt: true,
      },
    });

    // NRUS status
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const nrusConfig = await db.nRUSConfig.findFirst({ where: tenantFilter });
    const currentMonthSales = await db.sale.aggregate({
      _sum: { salePricePen: true },
      where: { ...tenantFilter, saleDate: { gte: startOfMonth, lte: endOfMonth }, status: "Completada" },
    });
    const salesPen = currentMonthSales._sum.salePricePen || 0;
    const monthlyRecord = await db.monthlySales.findFirst({ where: { month: currentMonthStr, ...tenantFilter } });
    const registeredSales = monthlyRecord?.totalSalesPen || 0;
    const totalMonthlySalesPen = registeredSales + salesPen;

    const configData = nrusConfig
      ? { cat1Threshold: nrusConfig.cat1Threshold, cat2Threshold: nrusConfig.cat2Threshold, igvRate: nrusConfig.igvRate, adValoremRate: nrusConfig.adValoremRate, perceptionRate: nrusConfig.perceptionRate, fobExemption: nrusConfig.fobExemption }
      : { cat1Threshold: 5000, cat2Threshold: 8000, igvRate: 0.18, adValoremRate: 0.04, perceptionRate: 0.10, fobExemption: 200 };

    const nrusStatus = getNRUSCategory(totalMonthlySalesPen, configData);

    const cat2Limit = nrusConfig?.cat2Threshold || 8000;
    const TC = 3.40;

    let fabioPurchasesPenThisMonth = 0;
    let peggyPurchasesPenThisMonth = 0;

    for (const prod of allProducts) {
      const pDate = prod.purchaseDate || prod.createdAt;
      if (pDate >= startOfMonthDate && pDate <= endOfMonth) {
        const usd = prod.purchasePriceUsd || 0;
        const pen = prod.totalCostPen || Math.round(usd * TC * 100) / 100;
        const isPeggy = (prod.importerProfile || '').toLowerCase() === 'peggy' ||
          (prod.recipientName || '').toLowerCase().includes('peggy') ||
          (prod.recipientName || '').toLowerCase().includes('orduña');
        if (isPeggy) {
          peggyPurchasesPenThisMonth += pen;
        } else {
          fabioPurchasesPenThisMonth += pen;
        }
      }
    }

    const fabioAvailablePen = Math.round((cat2Limit - fabioPurchasesPenThisMonth) * 100) / 100;
    const fabioAvailableUsd = Math.round((fabioAvailablePen / TC) * 100) / 100;
    const fabioConsumedPct = Math.round((fabioPurchasesPenThisMonth / cat2Limit) * 100);
    const fabioIsExceeded = fabioPurchasesPenThisMonth > cat2Limit;
    const fabioIsNearLimit = fabioPurchasesPenThisMonth >= 6000 && !fabioIsExceeded;

    const peggyAvailablePen = Math.round((cat2Limit - peggyPurchasesPenThisMonth) * 100) / 100;
    const peggyAvailableUsd = Math.round((peggyAvailablePen / TC) * 100) / 100;
    const peggyConsumedPct = Math.round((peggyPurchasesPenThisMonth / cat2Limit) * 100);
    const peggyIsExceeded = peggyPurchasesPenThisMonth > cat2Limit;
    const peggyIsNearLimit = peggyPurchasesPenThisMonth >= 6000 && !peggyIsExceeded;

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
      description = `Ambos titulares han superado el tope legal de compras de S/ 8,000 mensuales.`;
      actionBanner = 'DETENER compras bajo el Nuevo RUS durante este mes para evitar contingencias tributarias con SUNAT.';
    } else if (peggyIsExceeded) {
      target = 'fabio';
      targetName = 'FABIO CESAR HERRERA BONILLA';
      targetRuc = '10762026835';
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Peggy Excedido de Compras';
      description = `El RUC 10091870911 (Peggy) ha superado el tope mensual de S/ 8,000 en compras (S/ ${peggyPurchasesPenThisMonth.toFixed(2)} acumulados).`;
      actionBanner = `RECOMENDAMOS COMPRAR EXCLUSIVAMENTE CON EL RUC DISPONIBLE DE FABIO CÉSAR (10762026835). Saldo disponible: S/ ${fabioAvailablePen.toFixed(2)} ($${fabioAvailableUsd.toFixed(2)} USD).`;
    } else if (fabioIsExceeded) {
      target = 'peggy';
      targetName = 'BONILLA ORDUÑA PEGGY LILIANA';
      targetRuc = '10091870911';
      severity = 'critical';
      title = '🚨 ALERTA SUNAT NRUS: RUC de Fabio Excedido de Compras';
      description = `El RUC 10762026835 (Fabio) ha superado el tope mensual de S/ 8,000 en compras (S/ ${fabioPurchasesPenThisMonth.toFixed(2)} acumulados).`;
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

    return NextResponse.json({
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      activeProducts, totalClients, totalSales,
      avgTicket: Math.round(avgTicket * 100) / 100,
      productsByStatus, productsByGrade, monthlyRevenue: monthlyRevenueData,
      topSellingProducts, salesByChannel, recentSales,
      recentProducts: recentProducts.map((p) => {
        const itemMatch = p.notes?.match(/ItemID:\s*(\d+)/i) || p.description?.match(/#?(\d{12})/);
        const itemId = itemMatch ? itemMatch[1] : undefined;
        const itemUrl = itemId ? `https://www.ebay.com/itm/${itemId}` : undefined;
        const orderUrl = p.orderNumber && (p.orderNumber.includes('-') || /^\d{10,}$/.test(p.orderNumber))
          ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}`
          : undefined;

        return {
          id: p.id,
          description: p.description,
          status: p.shippingStatus,
          purchasePriceUSD: p.purchasePriceUsd,
          profitPEN: p.profitPen,
          category: p.category,
          grade: p.grade,
          orderNumber: p.orderNumber,
          courier: p.courier,
          trackingNumber: p.trackingId,
          purchaseDate: p.purchaseDate?.toISOString() || p.createdAt.toISOString(),
          importerProfile: p.importerProfile || 'fabio',
          itemId,
          itemUrl,
          orderUrl,
          createdAt: p.createdAt.toISOString(),
        };
      }),
      purchases: purchasesStats,
      nrus: {
        currentMonth: currentMonthStr, totalMonthlySalesPen: nrusStatus.totalMonthlySalesPen,
        category: nrusStatus.category, alertLevel: nrusStatus.alertLevel,
        percentageOfThreshold: nrusStatus.percentageOfThreshold,
        message: nrusStatus.message, currentThreshold: nrusStatus.currentThreshold,
        recommendation,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching dashboard stats:", error);
    const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
