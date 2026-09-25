import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helper';

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

// GET /api/compras/excel - Return purchases separated by year & month
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const selectedYear = searchParams.get('year'); // '2026', '2025', or 'all'
    const selectedMonth = searchParams.get('month'); // e.g. 'SEPTIEMBRE'

    // Fetch ALL products from DB for this tenant
    const products = await db.product.findMany({
      where: { tenantId: currentUser.tenantId },
      orderBy: { purchaseDate: 'desc' },
    });

    const mappedProducts = products.map((p) => {
      const pDate = p.purchaseDate || p.createdAt;
      const year = pDate.getFullYear();
      const monthIdx = pDate.getMonth();
      const monthName = MONTH_NAMES[monthIdx];
      const orderTotalUsd = (p.purchasePriceUsd || 0) + (p.shippingCostUsd || 0);

      // Order URL and Item URL
      let itemUrl: string | undefined = undefined;
      let orderUrl: string | undefined = undefined;
      if (p.orderNumber && p.orderNumber.includes('-')) {
        orderUrl = `https://order.ebay.com/ord/show?orderId=${p.orderNumber}`;
      }
      const itemMatch = p.notes?.match(/ItemID:\s*(\d+)/i) || p.description?.match(/#?(\d{12})/);
      if (itemMatch) {
        itemUrl = `https://www.ebay.com/itm/${itemMatch[1]}`;
      } else if (orderUrl) {
        itemUrl = orderUrl;
      }

      return {
        id: p.id,
        year: String(year),
        monthIndex: monthIdx,
        monthName,
        fechaCompraFormatted: pDate.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        purchaseDate: pDate.toISOString(),
        orderNumber: p.orderNumber,
        courier: p.courier || 'USPS',
        trackingNumber: (p.shipperTracking || p.trackingId || '').trim(),
        originalTracking: p.trackingId || '',
        shipperTracking: p.shipperTracking || '',
        shipperConfirmed: p.shipperConfirmed ?? false,
        supplier: p.supplier || 'eBay',
        supplierUrl: p.supplier ? `https://www.ebay.com/usr/${p.supplier}` : 'https://www.ebay.com',
        description: p.description,
        model: p.model || '',
        category: p.category || '',
        quantity: p.quantity || 1,
        purchasePriceUsd: p.purchasePriceUsd || 0,
        shippingCostUsd: p.shippingCostUsd || 0,
        orderTotalUsd,
        purchasePricePen: p.totalCostPen || orderTotalUsd * (p.exchangeRate || 3.40),
        salePricePen: p.salePricePen || 0,
        suggestedPricePen: p.suggestedPricePen || 0,
        advertisingCostUsd: p.advertisingCostUsd || 0,
        extraCostsUsd: p.extraCostsUsd || 0,
        profitPen: p.profitPen || 0,
        exchangeRate: p.exchangeRate || 3.40,
        shippingStatus: p.shippingStatus,
        isArchived: p.isArchived,
        importerProfile: p.importerProfile || 'fabio',
        orderUrl,
        itemUrl,
      };
    });

    // Extract available years and months
    const yearsSet = new Set<string>();
    const monthsByYear: Record<string, Set<string>> = {};

    mappedProducts.forEach((p) => {
      yearsSet.add(p.year);
      if (!monthsByYear[p.year]) {
        monthsByYear[p.year] = new Set<string>();
      }
      monthsByYear[p.year].add(p.monthName);
    });

    const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    const monthsStructure: Record<string, string[]> = {};
    for (const y of years) {
      // Sort months chronologically or reverse
      const mList = Array.from(monthsByYear[y] || []);
      mList.sort((a, b) => MONTH_NAMES.indexOf(b) - MONTH_NAMES.indexOf(a));
      monthsStructure[y] = mList;
    }

    return NextResponse.json({
      success: true,
      totalCount: mappedProducts.length,
      years,
      monthsStructure,
      products: mappedProducts,
    });
  } catch (error: any) {
    console.error('Error fetching compras data:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener compras' }, { status: 500 });
  }
}

// POST /api/compras/excel - Download updated Excel spreadsheet via SheetJS / ExcelJS
export async function POST(request: NextRequest) {
  try {
    const filePath = path.join(
      process.cwd(),
      'PLANTILLAS',
      'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx'
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="COMPRAS_EBAY_CONTABILIDAD_${dateStr}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
