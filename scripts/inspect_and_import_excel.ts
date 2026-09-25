import ExcelJS from 'exceljs';
import path from 'path';
import { db } from '../src/lib/db';

function extractCellText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    if (val.hyperlink) return String(val.hyperlink).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('').trim();
    }
  }
  return String(val).trim();
}

function getNumeric(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return Number(val.result) || fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseSpanishDate(dateStr: string, sheetName: string): Date {
  // Try standard Date parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Month names
  const months: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  // Determine year based on sheetName or dateStr
  let year = 2025;
  if (/2026/i.test(dateStr)) year = 2026;
  else if (/2025/i.test(dateStr)) year = 2025;
  else if (['ENERO', 'FEBRERO'].includes(sheetName)) year = 2026;
  else if (['ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'].includes(sheetName)) year = 2025;

  const m = dateStr.match(/(\d{1,2})\s+de\s+([a-zA-Z]+)(?:\s+de\s+(\d{4}))?/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthKey = m[2].toLowerCase();
    const month = months[monthKey] ?? 0;
    if (m[3]) year = parseInt(m[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  return new Date();
}

async function main() {
  const filePath = path.join(process.cwd(), 'PLANTILLAS', 'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const existingProducts = await db.product.findMany({
    select: { orderNumber: true, trackingId: true, id: true }
  });
  const existingOrders = new Set(existingProducts.map(p => p.orderNumber.trim()));

  console.log(`Productos ya en BD: ${existingProducts.length}`);

  let toImportCount = 0;
  const itemsToImport: any[] = [];

  for (const ws of wb.worksheets) {
    if (ws.name === 'TODO') continue; // Skip TODO to avoid duplicates with monthly sheets

    const headerRow = ws.getRow(3);
    const headerMap: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cell.value ? String(cell.value).trim().toUpperCase() : '';
      if (text.includes('FECHA') && text.includes('COMPRA')) headerMap.fechaCompra = col;
      else if (text === 'SISTEMA') headerMap.sistema = col;
      else if (text.includes('EMBARCA') || text.includes('ENVIADO')) headerMap.embarcado = col;
      else if (text.includes('ORDEN') || text.includes('NUMERO')) headerMap.orderNumber = col;
      else if (text.includes('COURIER')) headerMap.courier = col;
      else if (text.includes('TRACKING')) headerMap.tracking = col;
      else if (text.includes('PROVEEDOR')) headerMap.proveedor = col;
      else if (text.includes('DESCRIPCI') || text.includes('TITULO')) headerMap.descripcion = col;
      else if (text.includes('COMPRA') && (text.includes('$') || text.includes('USD'))) headerMap.precioUsd = col;
      else if (text.includes('VENTA') && !text.includes('FECHA')) headerMap.precioVentaPen = col;
      else if (text.includes('PUBLICIDAD')) headerMap.publicidadUsd = col;
      else if (text.includes('EXTRA') || text.includes('COSTOS')) headerMap.costosExtraUsd = col;
      else if (text.includes('GANANCIA')) headerMap.gananciaPen = col;
      else if (text.includes('STOCK')) headerMap.stock = col;
      else if (text.includes('SUGERIDO')) headerMap.precioSugeridoPen = col;
    });

    for (let r = 4; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const fechaStr = extractCellText(row.getCell(headerMap.fechaCompra || 2).value);
      const orderNumber = extractCellText(row.getCell(headerMap.orderNumber || 5).value);
      const desc = extractCellText(row.getCell(headerMap.descripcion || 9).value);
      const precioUsd = getNumeric(row.getCell(headerMap.precioUsd || 10).value);

      if (!fechaStr && !orderNumber && !desc) continue;
      if (/T\/C|TOTAL/i.test(fechaStr) || /TOTAL/i.test(desc)) continue;

      const cleanOrder = orderNumber || `HIST-${ws.name}-${r}`;
      if (existingOrders.has(cleanOrder)) {
        continue;
      }

      const courier = extractCellText(row.getCell(headerMap.courier || 6).value) || 'USPS';
      const tracking = extractCellText(row.getCell(headerMap.tracking || 7).value);
      const supplier = extractCellText(row.getCell(headerMap.proveedor || 8).value) || 'eBay';
      const purchaseDate = parseSpanishDate(fechaStr, ws.name);

      itemsToImport.push({
        orderNumber: cleanOrder,
        description: desc || 'Artículo eBay importado',
        purchasePriceUsd: precioUsd,
        shippingCostUsd: 0,
        exchangeRate: 3.40,
        totalCostPen: precioUsd * 3.40,
        courier,
        trackingId: tracking,
        supplier,
        salePricePen: getNumeric(row.getCell(headerMap.precioVentaPen || 12).value) || null,
        suggestedPricePen: getNumeric(row.getCell(headerMap.precioSugeridoPen || 17).value) || null,
        advertisingCostUsd: getNumeric(row.getCell(headerMap.publicidadUsd || 13).value) || null,
        extraCostsUsd: getNumeric(row.getCell(headerMap.costosExtraUsd || 14).value) || null,
        profitPen: getNumeric(row.getCell(headerMap.gananciaPen || 15).value) || null,
        quantity: getNumeric(row.getCell(headerMap.stock || 16).value, 1),
        purchaseDate,
        shippingStatus: 'Entregado',
        isArchived: true, // Historical items are archived so active inventory remains clean
        notes: `Importado de Excel hoja ${ws.name} fila ${r}`,
      });
      existingOrders.add(cleanOrder);
      toImportCount++;
    }
  }

  console.log(`Total registros históricos listos para importar a PostgreSQL: ${toImportCount}`);
  if (itemsToImport.length > 0) {
    console.log('Sample a importar:', itemsToImport.slice(0, 3));
  }
}

main().catch(console.error).finally(() => process.exit(0));
