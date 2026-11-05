import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";

const SPANISH_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function getMonthLabel(year: number, monthIdx: number): string {
  return `${SPANISH_MONTHS[monthIdx]} ${year}`;
}

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
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── 1. SALES QUERIES (db.sale) ─────────────────────────────────────
    const sales = await db.sale.findMany({
      where: {
        tenantId,
        status: "Completada",
      },
      include: { product: true },
      orderBy: { saleDate: "desc" },
    });

    // ── 2. PURCHASES QUERIES (db.product) ──────────────────────────────
    const products = await db.product.findMany({
      where: { tenantId },
      orderBy: { purchaseDate: "desc" },
    });

    // ── 3. MONTHLY SALES (SUNAT declared boletas) ───────────────────────
    const monthlySalesDb = await db.monthlySales.findMany({
      where: { tenantId },
      orderBy: { month: "desc" },
    });

    // ── 4. AGGREGATE MONTH-BY-MONTH HISTORY ────────────────────────────
    const monthMap: Record<string, {
      monthKey: string;
      label: string;
      ventasPen: number;
      costosPen: number;
      gananciaPen: number;
      margen: number;
      comprasUsd: number;
      comprasPen: number;
      flujoCajaPen: number;
      totalItemsPurchased: number;
      totalItemsSold: number;
      esDeclaradoSunat: boolean;
    }> = {};

    function ensureMonth(cleanKey: string, year: number, monthIdx: number) {
      if (!monthMap[cleanKey]) {
        monthMap[cleanKey] = {
          monthKey: cleanKey,
          label: getMonthLabel(year, monthIdx),
          ventasPen: 0,
          costosPen: 0,
          gananciaPen: 0,
          margen: 0,
          comprasUsd: 0,
          comprasPen: 0,
          flujoCajaPen: 0,
          totalItemsPurchased: 0,
          totalItemsSold: 0,
          esDeclaradoSunat: false,
        };
      }
      return monthMap[cleanKey];
    }

    // A) Process MonthlySales (SUNAT boletas)
    monthlySalesDb.forEach((ms) => {
      const cleanKey = ms.month.slice(0, 7); // "YYYY-MM"
      const [yStr, mStr] = cleanKey.split("-");
      const year = parseInt(yStr, 10);
      const mIdx = parseInt(mStr, 10) - 1;
      const entry = ensureMonth(cleanKey, year, mIdx);

      entry.ventasPen += ms.totalSalesPen;
      entry.esDeclaradoSunat = true;

      // Extract approximate items count from notes (e.g. "Ventas reales SUNAT: 7 boletas electrónicas")
      const boletaMatch = ms.notes?.match(/(\d+)\s+boletas/i);
      if (boletaMatch) {
        entry.totalItemsSold += parseInt(boletaMatch[1], 10);
      }

      if (ms.totalCostPen > 0) {
        entry.costosPen += ms.totalCostPen;
      } else {
        // Real empirical cost ratio from Excel: 38.2% (yielding ~61.8% real profit margin)
        entry.costosPen += Math.round(ms.totalSalesPen * 0.382 * 100) / 100;
      }
    });

    // B) Process individual db.sale records
    sales.forEach((s) => {
      const cleanKey = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, "0")}`;
      const entry = ensureMonth(cleanKey, s.saleDate.getFullYear(), s.saleDate.getMonth());

      // If no monthlySales was recorded for this period, add sale directly
      if (monthlySalesDb.length === 0 || !monthlySalesDb.some((m) => m.month.startsWith(cleanKey))) {
        entry.ventasPen += s.salePricePen;
        const c = s.costAcquisitionPen > 0 ? s.costAcquisitionPen : Math.round(s.salePricePen * 0.382 * 100) / 100;
        entry.costosPen += c;
      }
      entry.totalItemsSold += 1;
    });

    // C) Process all eBay purchases from products
    products.forEach((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      if (d && !isNaN(d.getTime())) {
        const cleanKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = ensureMonth(cleanKey, d.getFullYear(), d.getMonth());

        const usd = p.purchasePriceUsd || 0;
        const pen = p.totalCostPen > 0 ? p.totalCostPen : Math.round(usd * (p.exchangeRate || 3.45) * 100) / 100;

        entry.comprasUsd += usd;
        entry.comprasPen += pen;
        entry.totalItemsPurchased += 1;
      }
    });

    // D) Final calculation of net profit, margin %, and cashflow per month
    const historicalMonths = Object.values(monthMap)
      .map((m) => {
        const ganancia = m.ventasPen - m.costosPen;
        const margen = m.ventasPen > 0 ? (ganancia / m.ventasPen) * 100 : 0;
        const flujoCaja = m.ventasPen - m.comprasPen;

        return {
          monthKey: m.monthKey,
          label: m.label,
          ventasPen: Math.round(m.ventasPen * 100) / 100,
          costosPen: Math.round(m.costosPen * 100) / 100,
          gananciaPen: Math.round(ganancia * 100) / 100,
          margen: Math.round(margen * 10) / 10,
          comprasUsd: Math.round(m.comprasUsd * 100) / 100,
          comprasPen: Math.round(m.comprasPen * 100) / 100,
          flujoCajaPen: Math.round(flujoCaja * 100) / 100,
          totalItemsPurchased: m.totalItemsPurchased,
          totalItemsSold: m.totalItemsSold,
          esDeclaradoSunat: m.esDeclaradoSunat,
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // ── 5. DAILY METRICS (HOY) ─────────────────────────────────────────
    const salesToday = sales.filter((s) => s.saleDate >= startOfToday && s.saleDate <= endOfToday);
    const purchasesToday = products.filter((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      return d && d >= startOfToday && d <= endOfToday;
    });

    const ventasHoy = salesToday.reduce((acc, s) => acc + s.salePricePen, 0);
    const costosHoy = salesToday.reduce(
      (acc, s) => acc + (s.costAcquisitionPen > 0 ? s.costAcquisitionPen : s.salePricePen * 0.382),
      0
    );
    const gananciaHoy = ventasHoy - costosHoy;
    const margenHoy = ventasHoy > 0 ? (gananciaHoy / ventasHoy) * 100 : 0;
    const comprasHoyUsd = purchasesToday.reduce((acc, p) => acc + p.purchasePriceUsd, 0);
    const comprasHoyPen = purchasesToday.reduce(
      (acc, p) => acc + (p.totalCostPen > 0 ? p.totalCostPen : p.purchasePriceUsd * (p.exchangeRate || 3.45)),
      0
    );

    // ── 6. WEEKLY METRICS (ESTA SEMANA) ────────────────────────────────
    const salesWeek = sales.filter((s) => s.saleDate >= startOfWeek);
    const purchasesWeek = products.filter((p) => {
      const d = p.purchaseDate ? new Date(p.purchaseDate) : null;
      return d && d >= startOfWeek;
    });

    const ventasSemana = salesWeek.reduce((acc, s) => acc + s.salePricePen, 0);
    const costosSemana = salesWeek.reduce(
      (acc, s) => acc + (s.costAcquisitionPen > 0 ? s.costAcquisitionPen : s.salePricePen * 0.382),
      0
    );
    const gananciaSemana = ventasSemana - costosSemana;
    const margenSemana = ventasSemana > 0 ? (gananciaSemana / ventasSemana) * 100 : 0;
    const comprasSemanaUsd = purchasesWeek.reduce((acc, p) => acc + p.purchasePriceUsd, 0);
    const comprasSemanaPen = purchasesWeek.reduce(
      (acc, p) => acc + (p.totalCostPen > 0 ? p.totalCostPen : p.purchasePriceUsd * (p.exchangeRate || 3.45)),
      0
    );

    // ── 7. CURRENT MONTH METRICS ───────────────────────────────────────
    const currentMonthData = monthMap[currentMonthKey] || {
      ventasPen: 0,
      costosPen: 0,
      gananciaPen: 0,
      margen: 0,
      comprasUsd: 0,
      comprasPen: 0,
      flujoCajaPen: 0,
      totalItemsPurchased: 0,
      totalItemsSold: 0,
    };

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      daily: {
        ventasHoy: Math.round(ventasHoy * 100) / 100,
        costosHoy: Math.round(costosHoy * 100) / 100,
        gananciaHoy: Math.round(gananciaHoy * 100) / 100,
        margenHoy: Math.round(margenHoy * 10) / 10,
        comprasHoyUsd: Math.round(comprasHoyUsd * 100) / 100,
        comprasHoyPen: Math.round(comprasHoyPen * 100) / 100,
        itemsVendidosHoy: salesToday.length,
        itemsCompradosHoy: purchasesToday.length,
      },
      weekly: {
        ventasSemana: Math.round(ventasSemana * 100) / 100,
        costosSemana: Math.round(costosSemana * 100) / 100,
        gananciaSemana: Math.round(gananciaSemana * 100) / 100,
        margenSemana: Math.round(margenSemana * 10) / 10,
        comprasSemanaUsd: Math.round(comprasSemanaUsd * 100) / 100,
        comprasSemanaPen: Math.round(comprasSemanaPen * 100) / 100,
        itemsVendidosSemana: salesWeek.length,
        itemsCompradosSemana: purchasesWeek.length,
      },
      monthly: {
        mesNombre: getMonthLabel(now.getFullYear(), now.getMonth()),
        ventasMes: Math.round(currentMonthData.ventasPen * 100) / 100,
        costosMes: Math.round(currentMonthData.costosPen * 100) / 100,
        gananciaMes: Math.round((currentMonthData.ventasPen - currentMonthData.costosPen) * 100) / 100,
        margenMes: currentMonthData.ventasPen > 0
          ? Math.round(((currentMonthData.ventasPen - currentMonthData.costosPen) / currentMonthData.ventasPen) * 1000) / 10
          : 0,
        comprasMesUsd: Math.round(currentMonthData.comprasUsd * 100) / 100,
        comprasMesPen: Math.round(currentMonthData.comprasPen * 100) / 100,
        flujoCajaMes: Math.round((currentMonthData.ventasPen - currentMonthData.comprasPen) * 100) / 100,
        itemsVendidosMes: currentMonthData.totalItemsSold,
        itemsCompradosMes: currentMonthData.totalItemsPurchased,
      },
      historicalMonths: historicalMonths.slice(0, 18),
    });
  } catch (error: any) {
    console.error("Error in financial-summary:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener resumen financiero" },
      { status: 500 }
    );
  }
}
