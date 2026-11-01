import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    let tenantId = currentUser.tenantId;

    if (!tenantId) {
      const defaultTenant = await db.tenant.findFirst();
      if (!defaultTenant) {
        return NextResponse.json({ error: "No se encontró ningún Tenant" }, { status: 400 });
      }
      tenantId = defaultTenant.id;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Start of current week (Monday)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 = Mon
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── 1. SALES QUERIES ───────────────────────────────────────────────
    const sales = await db.sale.findMany({
      where: {
        tenantId,
        status: "Completada",
      },
      include: { product: true },
      orderBy: { saleDate: "desc" },
    });

    // ── 2. PURCHASES QUERIES ───────────────────────────────────────────
    const products = await db.product.findMany({
      where: { tenantId },
      orderBy: { purchaseDate: "desc" },
    });

    // ── 3. DAILY METRICS (HOY) ─────────────────────────────────────────
    const salesToday = sales.filter((s) => s.saleDate >= startOfToday && s.saleDate <= endOfToday);
    const purchasesToday = products.filter((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      return d && d >= startOfToday && d <= endOfToday;
    });

    const ventasHoy = salesToday.reduce((acc, s) => acc + s.salePricePen, 0);
    const costosHoy = salesToday.reduce((acc, s) => acc + s.costAcquisitionPen, 0);
    const gananciaHoy = ventasHoy - costosHoy;
    const margenHoy = ventasHoy > 0 ? (gananciaHoy / ventasHoy) * 100 : 0;
    const comprasHoyUsd = purchasesToday.reduce((acc, p) => acc + p.purchasePriceUsd, 0);

    // ── 4. WEEKLY METRICS (ESTA SEMANA) ────────────────────────────────
    const salesWeek = sales.filter((s) => s.saleDate >= startOfWeek);
    const purchasesWeek = products.filter((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      return d && d >= startOfWeek;
    });

    const ventasSemana = salesWeek.reduce((acc, s) => acc + s.salePricePen, 0);
    const costosSemana = salesWeek.reduce((acc, s) => acc + s.costAcquisitionPen, 0);
    const gananciaSemana = ventasSemana - costosSemana;
    const margenSemana = ventasSemana > 0 ? (gananciaSemana / ventasSemana) * 100 : 0;
    const comprasSemanaUsd = purchasesWeek.reduce((acc, p) => acc + p.purchasePriceUsd, 0);

    // ── 5. MONTHLY METRICS (ESTE MES EN CURSO) ─────────────────────────
    const salesMonth = sales.filter((s) => s.saleDate >= startOfMonth);
    const purchasesMonth = products.filter((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      return d && d >= startOfMonth;
    });

    const ventasMes = salesMonth.reduce((acc, s) => acc + s.salePricePen, 0);
    const costosMes = salesMonth.reduce((acc, s) => acc + s.costAcquisitionPen, 0);
    const gananciaMes = ventasMes - costosMes;
    const margenMes = ventasMes > 0 ? (gananciaMes / ventasMes) * 100 : 0;
    const comprasMesUsd = purchasesMonth.reduce((acc, p) => acc + p.purchasePriceUsd, 0);

    // ── 6. MONTH-BY-MONTH HISTORICAL SUMMARY ───────────────────────────
    const monthlySalesDb = await db.monthlySales.findMany({
      where: { tenantId },
      orderBy: { month: "desc" },
    });

    const monthMap: Record<string, {
      monthKey: string;
      label: string;
      ventasPen: number;
      costosPen: number;
      gananciaPen: number;
      comprasUsd: number;
      totalItemsPurchased: number;
      totalItemsSold: number;
    }> = {};

    const SPANISH_MONTHS = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    function getMonthLabel(year: number, monthIdx: number): string {
      return `${SPANISH_MONTHS[monthIdx]} ${year}`;
    }

    // Aggregate from MonthlySales (which holds SUNAT real declared boletas)
    monthlySalesDb.forEach((ms) => {
      // month field is like "2026-09-fabio" or "2026-09"
      const cleanKey = ms.month.slice(0, 7); // "YYYY-MM"
      const [yStr, mStr] = cleanKey.split("-");
      const year = parseInt(yStr, 10);
      const mIdx = parseInt(mStr, 10) - 1;

      if (!monthMap[cleanKey]) {
        monthMap[cleanKey] = {
          monthKey: cleanKey,
          label: getMonthLabel(year, mIdx),
          ventasPen: 0,
          costosPen: 0,
          gananciaPen: 0,
          comprasUsd: 0,
          totalItemsPurchased: 0,
          totalItemsSold: 0,
        };
      }
      monthMap[cleanKey].ventasPen += ms.totalSalesPen;
      monthMap[cleanKey].costosPen += ms.totalCostPen;
    });

    // Aggregate from real DB Sales
    sales.forEach((s) => {
      const cleanKey = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[cleanKey]) {
        monthMap[cleanKey] = {
          monthKey: cleanKey,
          label: getMonthLabel(s.saleDate.getFullYear(), s.saleDate.getMonth()),
          ventasPen: 0,
          costosPen: 0,
          gananciaPen: 0,
          comprasUsd: 0,
          totalItemsPurchased: 0,
          totalItemsSold: 0,
        };
      }
      // If no monthlySales was recorded for this sale, add it
      if (monthlySalesDb.length === 0 || !monthlySalesDb.some(m => m.month.startsWith(cleanKey))) {
        monthMap[cleanKey].ventasPen += s.salePricePen;
        monthMap[cleanKey].costosPen += s.costAcquisitionPen;
      }
      monthMap[cleanKey].totalItemsSold += 1;
    });

    // Aggregate purchases from products
    products.forEach((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      if (d && !isNaN(d.getTime())) {
        const cleanKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[cleanKey]) {
          monthMap[cleanKey].comprasUsd += p.purchasePriceUsd;
          monthMap[cleanKey].totalItemsPurchased += 1;
          if (monthMap[cleanKey].costosPen === 0) {
            monthMap[cleanKey].costosPen += p.totalCostPen || Math.round(p.purchasePriceUsd * 3.75);
          }
        }
      }
    });

    // Calculate final profit per month
    const historicalMonths = Object.values(monthMap)
      .map((m) => {
        const ganancia = m.ventasPen - m.costosPen;
        const margen = m.ventasPen > 0 ? (ganancia / m.ventasPen) * 100 : 0;
        return {
          ...m,
          gananciaPen: Math.round(ganancia * 100) / 100,
          margen: Math.round(margen * 10) / 10,
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      daily: {
        ventasHoy: Math.round(ventasHoy * 100) / 100,
        costosHoy: Math.round(costosHoy * 100) / 100,
        gananciaHoy: Math.round(gananciaHoy * 100) / 100,
        margenHoy: Math.round(margenHoy * 10) / 10,
        comprasHoyUsd: Math.round(comprasHoyUsd * 100) / 100,
        itemsVendidosHoy: salesToday.length,
        itemsCompradosHoy: purchasesToday.length,
      },
      weekly: {
        ventasSemana: Math.round(ventasSemana * 100) / 100,
        costosSemana: Math.round(costosSemana * 100) / 100,
        gananciaSemana: Math.round(gananciaSemana * 100) / 100,
        margenSemana: Math.round(margenSemana * 10) / 10,
        comprasSemanaUsd: Math.round(comprasSemanaUsd * 100) / 100,
        itemsVendidosSemana: salesWeek.length,
        itemsCompradosSemana: purchasesWeek.length,
      },
      monthly: {
        mesNombre: getMonthLabel(now.getFullYear(), now.getMonth()),
        ventasMes: Math.round(ventasMes * 100) / 100,
        costosMes: Math.round(costosMes * 100) / 100,
        gananciaMes: Math.round(gananciaMes * 100) / 100,
        margenMes: Math.round(margenMes * 10) / 10,
        comprasMesUsd: Math.round(comprasMesUsd * 100) / 100,
        itemsVendidosMes: salesMonth.length,
        itemsCompradosMes: purchasesMonth.length,
      },
      historicalMonths: historicalMonths.slice(0, 12),
    });
  } catch (error: any) {
    console.error("Error in financial-summary:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener resumen financiero" },
      { status: 500 }
    );
  }
}
