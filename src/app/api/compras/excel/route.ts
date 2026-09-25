import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helper';

// GET /api/compras/excel - Return Excel sheets & combined DB purchases
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const filePath = path.join(
      process.cwd(),
      'PLANTILLAS',
      'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx'
    );

    // Fetch DB products
    const dbProducts = await db.product.findMany({
      where: { tenantId: currentUser.tenantId },
      orderBy: { purchaseDate: 'desc' },
    });

    // Read Excel file
    let sheetNames: string[] = [];
    const sheetsData: Record<string, any[]> = {};

    if (fs.existsSync(filePath)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      sheetNames = wb.worksheets.map((w) => w.name);

      for (const ws of wb.worksheets) {
        const rows: any[] = [];
        // Rows start at index 4 (1-based)
        for (let r = 4; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const fecha = row.getCell(2).value;
          const orden = row.getCell(5).value;
          const desc = row.getCell(9).value;
          const precioUsd = row.getCell(10).value;

          if (!fecha && !orden && !desc && !precioUsd) continue;

          let descText = '';
          let descUrl = '';
          if (desc && typeof desc === 'object') {
            descText = (desc as any).text || '';
            descUrl = (desc as any).hyperlink || '';
          } else {
            descText = String(desc || '');
          }

          let provText = '';
          let provUrl = '';
          const prov = row.getCell(8).value;
          if (prov && typeof prov === 'object') {
            provText = (prov as any).text || '';
            provUrl = (prov as any).hyperlink || '';
          } else {
            provText = String(prov || '');
          }

          const getNumericValue = (val: any, fallback = 0): number => {
            if (val === null || val === undefined) return fallback;
            if (typeof val === 'object') return Number(val.result) || fallback;
            const n = Number(val);
            return isNaN(n) ? fallback : n;
          };

          const rawUsd = getNumericValue(precioUsd, 0);
          const precioSoles = row.getCell(11).value;
          const rawSoles = getNumericValue(precioSoles, rawUsd * 3.40);

          rows.push({
            rowNumber: r,
            sheet: ws.name,
            fechaCompra: String(fecha || ''),
            sistema: String(row.getCell(3).value || 'SI'),
            embarcado: String(row.getCell(4).value || 'NO'),
            orderNumber: String(orden || ''),
            courier: String(row.getCell(6).value || 'USPS'),
            trackingNumber: String(row.getCell(7).value || ''),
            proveedor: provText,
            proveedorUrl: provUrl,
            descripcion: descText,
            itemUrl: descUrl,
            precioCompraUsd: rawUsd,
            precioCompraPen: rawSoles,
            precioVentaPen: getNumericValue(row.getCell(12).value, 0),
            publicidadUsd: getNumericValue(row.getCell(13).value, 0),
            costosExtraUsd: getNumericValue(row.getCell(14).value, 0),
            gananciaPen: getNumericValue(row.getCell(15).value, 0),
            stock: getNumericValue(row.getCell(16).value, 1),
            precioSugeridoPen: getNumericValue(row.getCell(17).value, 0),
            fechaVenta: String(row.getCell(18).value || ''),
            metodoPago: String(row.getCell(19).value || ''),
          });
        }
        sheetsData[ws.name] = rows;
      }
    }

    return NextResponse.json({
      success: true,
      sheetNames,
      sheetsData,
      dbProductsCount: dbProducts.length,
      dbProducts: dbProducts.map((p) => {
        const orderTotalUsd = (p.purchasePriceUsd || 0) + (p.shippingCostUsd || 0);
        return {
          id: p.id,
          orderNumber: p.orderNumber,
          description: p.description,
          category: p.category,
          model: p.model,
          quantity: p.quantity || 1,
          purchasePriceUsd: p.purchasePriceUsd,
          shippingCostUsd: p.shippingCostUsd,
          orderTotalUsd,
          purchasePricePen: orderTotalUsd * (p.exchangeRate || 3.40),
          salePricePen: p.salePricePen || 0,
          suggestedPricePen: p.suggestedPricePen || 0,
          advertisingCostUsd: p.advertisingCostUsd || 0,
          extraCostsUsd: p.extraCostsUsd || 0,
          profitPen: p.profitPen || 0,
          exchangeRate: p.exchangeRate || 3.40,
          courier: p.courier || 'USPS',
          trackingNumber: p.trackingId || '',
          shipperTracking: p.shipperTracking || '',
          shipperConfirmed: p.shipperConfirmed ?? false,
          shippingStatus: p.shippingStatus,
          isArchived: p.isArchived,
          supplier: p.supplier || 'eBay',
          purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : p.createdAt.toISOString(),
          importerProfile: p.importerProfile || 'fabio',
        };
      }),
    });
  } catch (error: any) {
    console.error('Error reading compras excel:', error);
    return NextResponse.json({ error: error.message || 'Error al leer el archivo Excel' }, { status: 500 });
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
