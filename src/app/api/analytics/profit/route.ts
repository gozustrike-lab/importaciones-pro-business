import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/analytics/profit - Profit analytics (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const monthFilter = searchParams.get("month") || "";

    const salesWhere: Record<string, unknown> = { ...tenantFilter, status: "Completada" };
    if (monthFilter) {
      salesWhere.saleDate = {
        gte: new Date(`${monthFilter}-01T00:00:00.000Z`),
        lt: new Date(`${monthFilter}-31T23:59:59.999Z`),
      };
    }

    const sales = await db.sale.findMany({
      where: salesWhere, include: { product: true }, orderBy: { saleDate: "asc" },
    });

    let totalRevenue = 0, totalCostAcquisition = 0, totalCostMarketing = 0, totalCostOperative = 0;
    const productProfits: Record<string, { name: string; profit: number; margin: number; revenue: number; count: number }> = {};
    const monthlyData: Record<string, { month: string; revenue: number; costs: number; profit: number }> = {};
    const channelData: Record<string, { channel: string; revenue: number; profit: number; count: number }> = {};

    for (const sale of sales) {
      totalRevenue += sale.salePricePen;
      totalCostAcquisition += sale.costAcquisitionPen;
      totalCostMarketing += sale.costMarketingPen;
      totalCostOperative += sale.costOperativePen;

      if (!productProfits[sale.productId]) productProfits[sale.productId] = { name: sale.product.description, profit: 0, margin: 0, revenue: 0, count: 0 };
      productProfits[sale.productId].profit += sale.netProfitPen;
      productProfits[sale.productId].revenue += sale.salePricePen;
      productProfits[sale.productId].count += 1;

      const monthKey = `${sale.saleDate.getFullYear()}-${String(sale.saleDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { month: monthKey, revenue: 0, costs: 0, profit: 0 };
      monthlyData[monthKey].revenue += sale.salePricePen;
      monthlyData[monthKey].costs += sale.costAcquisitionPen + sale.costMarketingPen + sale.costOperativePen;
      monthlyData[monthKey].profit += sale.netProfitPen;

      const channelKey = sale.saleChannel || "Otro";
      if (!channelData[channelKey]) channelData[channelKey] = { channel: channelKey, revenue: 0, profit: 0, count: 0 };
      channelData[channelKey].revenue += sale.salePricePen;
      channelData[channelKey].profit += sale.netProfitPen;
      channelData[channelKey].count += 1;
    }

    const totalCosts = totalCostAcquisition + totalCostMarketing + totalCostOperative;
    const netProfit = totalRevenue - totalCosts;
    const avgMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const productsArr = Object.values(productProfits);
    productsArr.forEach((p) => { p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0; });
    productsArr.sort((a, b) => b.profit - a.profit);

    const monthlyBreakdown = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({
      month: m.month, revenue: Math.round(m.revenue * 100) / 100,
      costs: Math.round(m.costs * 100) / 100, profit: Math.round(m.profit * 100) / 100,
      margin: m.revenue > 0 ? Math.round((m.profit / m.revenue) * 10000) / 100 : 0,
    }));

    const salesByChannel = Object.values(channelData).map((c) => ({
      channel: c.channel, revenue: Math.round(c.revenue * 100) / 100,
      profit: Math.round(c.profit * 100) / 100, count: c.count,
    }));

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCostAcquisition: Math.round(totalCostAcquisition * 100) / 100,
      totalCostLogistics: Math.round(totalCostAcquisition * 0.15 * 100) / 100,
      totalCostMarketing: Math.round(totalCostMarketing * 100) / 100,
      totalCostOperative: Math.round(totalCostOperative * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      avgMargin: Math.round(avgMargin * 100) / 100,
      bestProduct: productsArr.length > 0 ? { name: productsArr[0].name, profit: Math.round(productsArr[0].profit * 100) / 100, margin: Math.round(productsArr[0].margin * 100) / 100 } : null,
      worstProduct: productsArr.length > 0 ? { name: productsArr[productsArr.length - 1].name, profit: Math.round(productsArr[productsArr.length - 1].profit * 100) / 100, margin: Math.round(productsArr[productsArr.length - 1].margin * 100) / 100 } : null,
      monthlyBreakdown, salesByChannel,
    });
  } catch (error: unknown) {
    console.error("Error fetching profit analytics:", error);
    const message = error instanceof Error ? error.message : "Error al obtener analítica";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
