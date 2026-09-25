import ExcelJS from 'exceljs';
import path from 'path';
import { db } from '../src/lib/db';

function extractText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val).trim();
  if (typeof val === 'object') {
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined && val.result !== null) return String(val.result).trim();
    if (val.hyperlink) return String(val.hyperlink).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('').trim();
    }
  }
  return '';
}

function getNumeric(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return Number(val.result) || fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseSpanishDate(dateStr: string, sheetName: string): Date {
  const months: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

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

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  return new Date();
}

async function main() {
  const filePath = path.join(process.cwd(), 'PLANTILLAS', 'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const existingProds = await db.product.findMany({
    select: { orderNumber: true }
  });
  const existingOrders = new Set(existingProds.map(p => p.orderNumber.trim()));
  const sample = await db.product.findFirst({ select: { tenantId: true } });
  const tenantId = sample?.tenantId || 'cmonl58vm0000rf2jq4h3jkv1';

  console.log(`Productos ya en BD: ${existingOrders.size}`);

  let inserted = 0;
  for (const ws of wb.worksheets) {
    if (ws.name === 'TODO') continue;

    // Detect column indexes from row 3
    const headerRow = ws.getRow(3);
    const colMap: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: false }, (c, col) => {
      const h = String(c.value || '').trim().toUpperCase();
      if (h.includes('FECHA') && h.includes('COMPRA')) colMap.fecha = col;
      else if (h.includes('ORDEN') || h.includes('NUMERO')) colMap.orden = col;
      else if (h.includes('COURIER')) colMap.courier = col;
      else if (h.includes('TRACKING')) colMap.tracking = col;
      else if (h.includes('PROVEEDOR')) colMap.proveedor = col;
      else if (h.includes('DESCRIPCI') || h.includes('TITULO')) colMap.desc = col;
      else if (h.includes('COMPRA') && (h.includes('$') || h.includes('USD'))) colMap.precioUsd = col;
      else if (h.includes('VENTA') && !h.includes('FECHA')) colMap.ventaPen = col;
      else if (h.includes('PUBLICIDAD')) colMap.publicidad = col;
      else if (h.includes('EXTRA') || h.includes('COSTOS')) colMap.costosExtra = col;
      else if (h.includes('GANANCIA')) colMap.ganancia = col;
      else if (h.includes('STOCK')) colMap.stock = col;
      else if (h.includes('SUGERIDO')) colMap.sugerido = col;
    });

    for (let r = 4; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const fechaStr = extractText(row.getCell(colMap.fecha || 2).value);
      let ordenStr = extractText(row.getCell(colMap.orden || 5).value);
      let descStr = extractText(row.getCell(colMap.desc || 9).value);
      const precioUsd = getNumeric(row.getCell(colMap.precioUsd || 10).value);

      if (!fechaStr && !ordenStr && !descStr) continue;
      if (/T\/C|TOTAL/i.test(fechaStr) || /TOTAL/i.test(descStr) || /T\/C|TOTAL/i.test(ordenStr)) continue;

      // Swap if order was detected in courier or other column (e.g. MAYO or JUNIO)
      if (!/\d{2}-\d{5}-\d{5}/.test(ordenStr)) {
        const c6 = extractText(row.getCell(6).value);
        if (/\d{2}-\d{5}-\d{5}/.test(c6)) {
          ordenStr = c6;
        }
      }

      if (!ordenStr) {
        ordenStr = `HIST-${ws.name}-${r}`;
      }

      if (existingOrders.has(ordenStr)) {
        continue;
      }

      if (precioUsd <= 0 && descStr.length < 5) continue;

      let courier = extractText(row.getCell(colMap.courier || 6).value);
      if (courier === 'SI' || courier === 'NO' || courier.includes('-')) {
        courier = 'USPS';
      }
      if (!courier) courier = 'USPS';

      let tracking = extractText(row.getCell(colMap.tracking || 7).value);
      if (tracking.includes('http') || tracking.length > 50) {
        const m = tracking.match(/\b(1Z[A-Z0-9]{16}|\d{20,24}|\d{12})\b/i);
        tracking = m ? m[1] : '';
      }

      let supplier = extractText(row.getCell(colMap.proveedor || 8).value);
      if (supplier.includes('http')) {
        const m = supplier.match(/usr\/([^/?]+)/i);
        supplier = m ? m[1] : 'eBay';
      }
      if (!supplier || supplier.length > 30) supplier = 'eBay';

      const pDate = parseSpanishDate(fechaStr, ws.name);
      const tc = 3.40;

      await db.product.create({
        data: {
          tenant: { connect: { id: tenantId } },
          orderNumber: ordenStr,
          description: descStr || 'Artículo eBay importado',
          purchasePriceUsd: precioUsd,
          shippingCostUsd: 0,
          exchangeRate: tc,
          totalCostPen: precioUsd * tc,
          courier,
          trackingId: tracking,
          supplier,
          salePricePen: getNumeric(row.getCell(colMap.ventaPen || 12).value, 0),
          suggestedPricePen: getNumeric(row.getCell(colMap.sugerido || 17).value, 0),
          advertisingCostUsd: getNumeric(row.getCell(colMap.publicidad || 13).value, 0),
          extraCostsUsd: getNumeric(row.getCell(colMap.costosExtra || 14).value, 0),
          profitPen: getNumeric(row.getCell(colMap.ganancia || 15).value, 0),
          quantity: Math.max(1, Math.round(getNumeric(row.getCell(colMap.stock || 16).value, 1))),
          purchaseDate: pDate,
          shippingStatus: 'Entregado',
          isArchived: true,
          notes: `Importado de Excel hoja ${ws.name} fila ${r}`,
        },
      });

      existingOrders.add(ordenStr);
      inserted++;
    }
  }

  console.log(`✓ Insertados exitosamente ${inserted} productos históricos a PostgreSQL.`);
  const finalCount = await db.product.count();
  console.log(`Total productos ahora en PostgreSQL: ${finalCount}`);
}

main().catch(console.error).finally(() => process.exit(0));
