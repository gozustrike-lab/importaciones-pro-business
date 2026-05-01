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
    const productsByStatus: Record<string, number> = { USA: 0, "En Tránsito": 0, Perú: 0, Entregado: 0, Vendido: 0 };
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

    const recentProducts = await db.product.findMany({
      where: tenantFilter, orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, description: true, shippingStatus: true, purchasePriceUsd: true, profitPen: true, category: true, grade: true, createdAt: true },
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

    return NextResponse.json({
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      activeProducts, totalClients, totalSales,
      avgTicket: Math.round(avgTicket * 100) / 100,
      productsByStatus, productsByGrade, monthlyRevenue,
      topSellingProducts, salesByChannel, recentSales,
      recentProducts: recentProducts.map((p) => ({
        id: p.id, description: p.description, status: p.shippingStatus,
        purchasePriceUSD: p.purchasePriceUsd, profitPEN: p.profitPen,
        category: p.category, grade: p.grade, createdAt: p.createdAt.toISOString(),
      })),
      nrus: {
        currentMonth: currentMonthStr, totalMonthlySalesPen: nrusStatus.totalMonthlySalesPen,
        category: nrusStatus.category, alertLevel: nrusStatus.alertLevel,
        percentageOfThreshold: nrusStatus.percentageOfThreshold,
        message: nrusStatus.message, currentThreshold: nrusStatus.currentThreshold,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching dashboard stats:", error);
    const message = error instanceof Error ? error.message : "Error al obtener estadísticas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
