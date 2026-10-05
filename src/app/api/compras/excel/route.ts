import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helper';
import { getExcelWorkbookPath } from '@/lib/excel-compras-writer';

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

// GET /api/compras/excel - Return purchases separated by year & month OR real Excel workbook sheets
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'workbook' for live real .xlsx sheet view

    if (mode === 'workbook') {
      const ownerParam = (searchParams.get('owner') || '').toLowerCase();
      const isLiliana = ownerParam === 'liliana' || ownerParam === 'peggy';
      const owner = isLiliana ? 'liliana' : 'fabio';
      const year = searchParams.get('year') || '2026';
      const requestedSheet = searchParams.get('sheet') || '';
      const filePath = getExcelWorkbookPath(isLiliana, year);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: `Archivo Excel de ${isLiliana ? 'Peggy / Liliana' : 'Fabio'} (${year}) no encontrado en ${filePath}` }, { status: 404 });
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const sheets = wb.worksheets.map((ws) => ws.name);
      const activeSheet = requestedSheet && sheets.includes(requestedSheet)
        ? requestedSheet
        : sheets[0] || '';

      const ws = wb.getWorksheet(activeSheet);
      const cleanRows: any[][] = [];
      if (ws) {
        for (let r = 1; r <= Math.min(ws.rowCount, 120); r++) {
          const row = ws.getRow(r);
          const rowValues: any[] = [];
          let hasContent = false;
          for (let c = 1; c <= 24; c++) {
            const cell = row.getCell(c);
            const val = cell.value;
            if (val !== null && val !== undefined && val !== '') {
              hasContent = true;
            }
            if (val instanceof Date) {
              rowValues.push(val.toLocaleDateString('es-PE'));
            } else if (val && typeof val === 'object') {
              if ('hyperlink' in val) {
                rowValues.push({
                  text: (val as any).text || '',
                  hyperlink: (val as any).hyperlink || '',
                });
              } else if ('result' in val) {
                const res = (val as any).result;
                if (typeof res === 'number') {
                  rowValues.push(Math.round(res * 100) / 100);
                } else {
                  rowValues.push(String(res ?? ''));
                }
              } else if (Array.isArray((val as any).richText)) {
                rowValues.push((val as any).richText.map((t: any) => t.text || '').join(''));
              } else if ('formula' in val) {
                const res = (val as any).result;
                if (typeof res === 'number') {
                  rowValues.push(Math.round(res * 100) / 100);
                } else if (res !== undefined && res !== null) {
                  rowValues.push(String(res));
                } else {
                  rowValues.push('');
                }
              } else {
                rowValues.push('');
              }
            } else if (typeof val === 'number') {
              rowValues.push(Math.round(val * 100) / 100);
            } else {
              rowValues.push(String(val ?? ''));
            }
          }
          if (hasContent) {
            cleanRows.push(rowValues);
          }
        }
      }

      return NextResponse.json({
        success: true,
        owner,
        fileName: path.basename(filePath),
        filePath,
        sheets,
        activeSheet,
        rows: cleanRows,
      });
    }

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

      // Order URL & Item URL strictly separated
      let orderUrl: string | undefined = undefined;
      if (p.orderNumber && (p.orderNumber.includes('-') || /^\d{10,}$/.test(p.orderNumber))) {
        orderUrl = `https://order.ebay.com/ord/show?orderId=${p.orderNumber}`;
      }

      let itemUrl: string | undefined = undefined;
      const itemMatch = p.notes?.match(/ItemID:\s*(\d+)/i) || p.description?.match(/#?(\d{12})/);
      if (itemMatch) {
        itemUrl = `https://www.ebay.com/itm/${itemMatch[1]}`;
      }

      const imgMatch = p.notes?.match(/Img:\s*(https?:\/\/[^\s|]+)/i);
      const imageUrl = imgMatch ? imgMatch[1] : undefined;

      const rawSupplier = (p.supplier || '').trim();
      const isGenericSupplier =
        !rawSupplier ||
        ['ebay', 'usps', 'ups', 'fedex', 'dhl', 'desconocido'].includes(rawSupplier.toLowerCase());
      const supplierUrl = isGenericSupplier
        ? 'https://www.ebay.com'
        : `https://www.ebay.com/usr/${encodeURIComponent(rawSupplier)}`;

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
        supplierUrl,
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
        recipientName: p.recipientName || '',
        orderUrl,
        itemUrl,
        imageUrl,
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

// POST /api/compras/excel - Download updated Excel spreadsheet (Fabio or Liliana)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerParam = (searchParams.get('owner') || '').toLowerCase();
    const isLiliana = ownerParam === 'liliana' || ownerParam === 'peggy';
    const year = searchParams.get('year') || '2026';
    let filePath = getExcelWorkbookPath(isLiliana, year);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(
        process.cwd(),
        'PLANTILLAS',
        'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx'
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const dateStr = new Date().toISOString().slice(0, 10);
    const label = isLiliana ? 'LILIANA' : 'FABIO';
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Compras_Ebay_${label}_${dateStr}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error downloading excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

