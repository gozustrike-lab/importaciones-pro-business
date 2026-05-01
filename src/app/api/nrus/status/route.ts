import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNRUSCategory } from "@/lib/business-logic";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/nrus/status - Get NRUS status (tenant-scoped)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    let nrusConfig = await db.nRUSConfig.findFirst({ where: tenantFilter });

    if (!nrusConfig && currentUser.tenantId) {
      nrusConfig = await db.nRUSConfig.create({
        data: {
          ruc: "10762026835", businessName: "Importaciones Perú",
          cat1Threshold: 5000, cat2Threshold: 8000,
          igvRate: 0.18, adValoremRate: 0.04,
          perceptionRate: 0.10, fobExemption: 200,
          tenantId: currentUser.tenantId,
        },
      });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const monthlySales = await db.monthlySales.findFirst({
      where: { month: currentMonth, ...tenantFilter },
    });
    const registeredSales = monthlySales?.totalSalesPen || 0;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthProductSales = await db.product.aggregate({
      _sum: { salePricePen: true },
      where: { ...tenantFilter, saleDate: { gte: startOfMonth, lte: endOfMonth } },
    });
    const productSalesPen = currentMonthProductSales._sum.salePricePen || 0;
    const totalMonthlySalesPen = registeredSales + productSalesPen;

    if (!nrusConfig) {
      return NextResponse.json({
        currentMonth, currentYear: now.getFullYear(),
        monthlySales: totalMonthlySalesPen,
        category1Limit: 5000, category2Limit: 8000,
        currentCategory: "Cat 1", alertLevel: "normal",
        percentageOfThreshold: 0, message: "Configuración NRUS no disponible",
        igvRate: 18, adValoremRate: 4, percepcionRate: 10,
      });
    }

    const nrusStatus = getNRUSCategory(totalMonthlySalesPen, {
      cat1Threshold: nrusConfig.cat1Threshold, cat2Threshold: nrusConfig.cat2Threshold,
      igvRate: nrusConfig.igvRate, adValoremRate: nrusConfig.adValoremRate,
      perceptionRate: nrusConfig.perceptionRate, fobExemption: nrusConfig.fobExemption,
    });

    return NextResponse.json({
      currentMonth, currentYear: now.getFullYear(),
      monthlySales: nrusStatus.totalMonthlySalesPen,
      category1Limit: nrusConfig.cat1Threshold,
      category2Limit: nrusConfig.cat2Threshold,
      currentCategory: nrusStatus.category as 'Cat 1' | 'Cat 2' | 'Excedido',
      alertLevel: nrusStatus.alertLevel === 'exceeded' ? 'red' :
                  nrusStatus.alertLevel === 'danger' ? 'orange' :
                  nrusStatus.alertLevel === 'warning' ? 'yellow' : 'normal',
      percentageOfThreshold: nrusStatus.percentageOfThreshold,
      message: nrusStatus.message,
      igvRate: nrusConfig.igvRate * 100,
      adValoremRate: nrusConfig.adValoremRate * 100,
      percepcionRate: nrusConfig.perceptionRate * 100,
    });
  } catch (error: unknown) {
    console.error("Error fetching NRUS status:", error);
    return NextResponse.json({ error: "Error al obtener el estado NRUS" }, { status: 500 });
  }
}
