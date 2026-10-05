import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';

const ALL_MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MONTH_NAMES_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatSpanishDate(d: Date): string {
  const day = d.getDate();
  const month = MONTH_NAMES_LOWER[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} de ${month} de ${year} a las ${hours}:${mins}`;
}

const HEADER_TITLES: Record<number, string> = {
  2: 'FECHA COMPRA',
  3: 'SISTEMA',
  4: 'ENVIADO EMBARCACIÓN',
  5: 'NUMERO DE ORDEN',
  6: 'COURIER',
  7: 'TRACKING ORIGINAL',
  8: 'TRACKING SHIPER (EMBARQUE)',
  9: 'PROVEEDOR',
  10: 'DESCRIPCIÓN',
  11: 'PRECIO COMPRA $',
  12: 'PRECIO COMPRA S/',
  13: 'PRECIO DE VENTA',
  14: 'PUBLICIDAD',
  15: 'COSTOS EXTRA',
  16: 'GANANCIA',
  17: 'STOCK',
  18: 'PRECIO SUGERIDO',
  19: 'FECHA VENTA',
  20: 'METODO DE PAGO',
  22: 'T/C'
};

const COLUMN_WIDTHS: Record<number, number> = {
  1: 4,
  2: 28,  // Fecha Compra
  3: 10,  // Sistema
  4: 16,  // Enviado
  5: 22,  // N Orden
  6: 12,  // Courier
  7: 26,  // Tracking Original
  8: 32,  // Tracking Shiper
  9: 18,  // Proveedor
  10: 45, // Descripcion
  11: 16, // Precio $
  12: 16, // Precio S/
  13: 16, // Venta
  14: 12,
  15: 12,
  16: 14,
  17: 8,
  18: 16,
  19: 16,
  20: 16,
  21: 4,
  22: 10
};

const fontHeader: Partial<ExcelJS.Font> = {
  name: 'Aptos Narrow',
  size: 11,
  bold: true,
  color: { argb: 'FF000000' }
};

const fillHeader: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9E1F2' } // Light soft blue/gray header
};

const borderThin: Partial<ExcelJS.Borders> = {
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }
};

const fontData: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 10,
  color: { argb: 'FF111820' }
};

const fontLink: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 10,
  color: { argb: 'FF0563C1' },
  underline: true
};

function setupSheetHeaders(ws: ExcelJS.Worksheet) {
  // Set column widths
  for (const [col, width] of Object.entries(COLUMN_WIDTHS)) {
    ws.getColumn(parseInt(col, 10)).width = width;
  }

  // Row 3: Headers
  const r3 = ws.getRow(3);
  r3.height = 24;

  for (let c = 2; c <= 22; c++) {
    const title = HEADER_TITLES[c];
    const cell = r3.getCell(c);
    if (title) {
      cell.value = title;
      cell.font = fontHeader;
      cell.fill = fillHeader;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: c >= 11 && c <= 16 ? 'right' : 'center' };
    }
  }

  // T/C default in V3 & V4
  ws.getCell('V3').value = 'T/C';
  ws.getCell('V3').font = fontHeader;
  ws.getCell('V3').fill = fillHeader;
  ws.getCell('V3').alignment = { vertical: 'middle', horizontal: 'center' };

  ws.getCell('V4').value = 3.40;
  ws.getCell('V4').numFmt = '0.00';
  ws.getCell('V4').font = { name: 'Arial', size: 10, bold: true };
  ws.getCell('V4').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell('V4').border = borderThin;
}

function writeProductRow(ws: ExcelJS.Worksheet, rowIdx: number, p: any, tc: number = 3.40) {
  const row = ws.getRow(rowIdx);
  row.height = 20;

  const pDate = p.purchaseDate || p.createdAt;
  const itemMatch = p.notes?.match(/ItemID:\s*(\d+)/i) || p.description?.match(/#?(\d{12})/);
  const itemId = itemMatch ? itemMatch[1] : undefined;

  const rawSupplier = (p.supplier || '').trim();
  const isGenericSupplier = !rawSupplier || ['ebay', 'usps', 'ups', 'fedex', 'dhl', 'desconocido'].includes(rawSupplier.toLowerCase());

  const inMiamiSystem = p.isArchived || p.shippingStatus === 'ENTREGADO_LIMA' || p.shipperConfirmed;
  const originalTrack = (p.trackingId || '').trim();
  const shiperTrack = inMiamiSystem ? (p.shipperTracking || originalTrack).trim() : '';

  const priceUsd = Number(p.purchasePriceUsd) || 0;
  const pricePen = p.totalCostPen || Math.round(priceUsd * tc * 100) / 100;

  // C2: Fecha Compra
  row.getCell(2).value = formatSpanishDate(pDate);
  row.getCell(2).font = fontData;
  row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(2).border = borderThin;

  // C3: Sistema (Verificado por Shiper en Miami)
  row.getCell(3).value = inMiamiSystem ? 'SI' : 'NO';
  row.getCell(3).font = inMiamiSystem
    ? fontData
    : { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9C0006' } };
  row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(3).border = borderThin;
  if (!inMiamiSystem) {
    row.getCell(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC7CE' } // Soft red / alert for NO figura en sistema de Miami
    };
  }

  // C4: Enviado Embarcación (SOLO 'SI' O 'NO')
  const isEnviadoEmbarcacion = p.isArchived || p.shippingStatus === 'ENTREGADO_LIMA';
  row.getCell(4).value = isEnviadoEmbarcacion ? 'SI' : 'NO';
  row.getCell(4).font = fontData;
  row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(4).border = borderThin;

  // C5: Numero de Orden
  const ordVal = (p.orderNumber || '').trim();
  if (ordVal && (ordVal.includes('-') || /^\d{10,}$/.test(ordVal))) {
    row.getCell(5).value = {
      text: ordVal,
      hyperlink: `https://order.ebay.com/ord/show?orderId=${ordVal}`
    };
    row.getCell(5).font = fontLink;
  } else {
    row.getCell(5).value = ordVal;
    row.getCell(5).font = fontData;
  }
  row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(5).border = borderThin;

  // C6: Courier
  row.getCell(6).value = (p.courier || 'USPS').toUpperCase();
  row.getCell(6).font = fontData;
  row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(6).border = borderThin;

  // C7: Tracking Original
  row.getCell(7).value = originalTrack;
  row.getCell(7).font = fontData;
  row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(7).border = borderThin;

  // C8: Tracking Shiper (Embarque) - Vacío si NO figura en sistema Shiper Miami
  row.getCell(8).value = shiperTrack;
  row.getCell(8).font = fontData;
  row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(8).border = borderThin;
  if (inMiamiSystem && (shiperTrack !== originalTrack || p.shipperConfirmed)) {
    row.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' } // Soft green highlight for shiper verified
    };
  }

  // C9: Proveedor
  if (!isGenericSupplier) {
    row.getCell(9).value = {
      text: rawSupplier,
      hyperlink: `https://www.ebay.com/usr/${encodeURIComponent(rawSupplier)}`
    };
    row.getCell(9).font = fontLink;
  } else {
    row.getCell(9).value = {
      text: 'eBay',
      hyperlink: 'https://www.ebay.com'
    };
    row.getCell(9).font = fontLink;
  }
  row.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(9).border = borderThin;

  // C10: Descripción (100% hyperlinks: direct item or authentic eBay search)
  const descText = (p.description || '').trim();
  if (itemId) {
    row.getCell(10).value = {
      text: descText,
      hyperlink: `https://www.ebay.com/itm/${itemId}`
    };
    row.getCell(10).font = fontLink;
  } else {
    const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(descText.slice(0, 60))}`;
    row.getCell(10).value = {
      text: descText,
      hyperlink: searchUrl
    };
    row.getCell(10).font = fontLink;
  }
  row.getCell(10).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(10).border = borderThin;

  // C11: Precio Compra $
  row.getCell(11).value = priceUsd;
  row.getCell(11).numFmt = '#,##0.00';
  row.getCell(11).font = fontData;
  row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(11).border = borderThin;

  // C12: Precio Compra S/ (formula linked to V4 exchange rate)
  row.getCell(12).value = {
    formula: `K${rowIdx}*$V$4`,
    result: pricePen
  };
  row.getCell(12).numFmt = '#,##0.00';
  row.getCell(12).font = fontData;
  row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(12).border = borderThin;

  // C13: Precio de Venta
  row.getCell(13).value = p.salePricePen || 0;
  row.getCell(13).numFmt = '#,##0.00';
  row.getCell(13).font = fontData;
  row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(13).border = borderThin;

  // C14: Publicidad
  row.getCell(14).value = p.advertisingCostUsd || 0;
  row.getCell(14).font = fontData;
  row.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(14).border = borderThin;

  // C15: Costos Extra
  row.getCell(15).value = p.extraCostsUsd || 0;
  row.getCell(15).font = fontData;
  row.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(15).border = borderThin;

  // C16: Ganancia
  row.getCell(16).value = {
    formula: `M${rowIdx}-L${rowIdx}`,
    result: p.profitPen || 0
  };
  row.getCell(16).numFmt = '#,##0.00';
  row.getCell(16).font = fontData;
  row.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(16).border = borderThin;

  // C17: Stock
  row.getCell(17).value = p.quantity || 1;
  row.getCell(17).font = fontData;
  row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(17).border = borderThin;

  // C18: Sugerido
  row.getCell(18).value = p.suggestedPricePen || 0;
  row.getCell(18).numFmt = '#,##0.00';
  row.getCell(18).font = fontData;
  row.getCell(18).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(18).border = borderThin;

  // C19: Fecha Venta
  row.getCell(19).value = p.saleDate ? formatSpanishDate(p.saleDate) : '';
  row.getCell(19).font = fontData;
  row.getCell(19).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(19).border = borderThin;

  // C20: Metodo de Pago
  row.getCell(20).value = p.saleChannel || '';
  row.getCell(20).font = fontData;
  row.getCell(20).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(20).border = borderThin;
}

function addTotalsRow(ws: ExcelJS.Worksheet, rowIdx: number, startRow: number, endRow: number) {
  if (startRow > endRow) return;
  const row = ws.getRow(rowIdx);
  row.height = 22;

  // C10: Label
  row.getCell(10).value = 'TOTAL';
  row.getCell(10).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(10).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };

  // C11: Sum USD
  row.getCell(11).value = {
    formula: `SUM(K${startRow}:K${endRow})`
  };
  row.getCell(11).numFmt = '$#,##0.00';
  row.getCell(11).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(11).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };

  // C12: Sum PEN
  row.getCell(12).value = {
    formula: `SUM(L${startRow}:L${endRow})`
  };
  row.getCell(12).numFmt = 'S/#,##0.00';
  row.getCell(12).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(12).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };

  // C13: Sum Venta PEN
  row.getCell(13).value = {
    formula: `SUM(M${startRow}:M${endRow})`
  };
  row.getCell(13).numFmt = 'S/#,##0.00';
  row.getCell(13).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(13).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };

  // C16: Sum Ganancia
  row.getCell(16).value = {
    formula: `SUM(P${startRow}:P${endRow})`
  };
  row.getCell(16).numFmt = 'S/#,##0.00';
  row.getCell(16).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(16).alignment = { vertical: 'middle', horizontal: 'right' };
  row.getCell(16).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };

  // C17: Sum Stock
  row.getCell(17).value = {
    formula: `SUM(Q${startRow}:Q${endRow})`
  };
  row.getCell(17).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  row.getCell(17).alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(17).border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'double', color: { argb: 'FF000000' } }
  };
}

async function processWorkbook(owner: 'fabio' | 'peggy', year: 2025 | 2026, filePaths: string[]) {
  console.log(`\n=================== GENERATING ${owner.toUpperCase()} ${year} WORKBOOK ===================`);
  console.log(`Destinations:\n  - ${filePaths.join('\n  - ')}`);

  // Brand new workbook to guarantee clean sheets and EXACT chronological order
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Importaciones USA - PERU';
  wb.lastModifiedBy = 'Importaciones USA - PERU';
  wb.created = new Date();
  wb.modified = new Date();

  // Get all products for this owner from DB for THIS SPECIFIC YEAR
  const allProds = await db.product.findMany({
    orderBy: { purchaseDate: 'asc' }
  });

  const ownerProds = allProds.filter(p => {
    const isPeggy = (p.importerProfile || '').toLowerCase().includes('peggy') ||
                    (p.importerProfile || '').toLowerCase().includes('liliana') ||
                    (p.recipientName || '').toLowerCase().includes('peggy') ||
                    (p.recipientName || '').toLowerCase().includes('liliana');
    const matchesOwner = owner === 'peggy' ? isPeggy : !isPeggy;
    const pYear = (p.purchaseDate || p.createdAt).getFullYear();
    return matchesOwner && pYear === year;
  });

  console.log(`Total products for ${owner.toUpperCase()} in ${year}: ${ownerProds.length}`);

  // Group products by month for this year only
  const byMonth: Record<string, any[]> = {};
  for (const m of ALL_MONTHS) byMonth[m] = [];

  ownerProds.forEach(p => {
    const d = p.purchaseDate || p.createdAt;
    const mName = ALL_MONTHS[d.getMonth()];
    byMonth[mName].push(p);
  });

  // 1. MASTER SHEET "TODO" AS TAB #1
  const todoTitle = `TODO ${year}`;
  console.log(`Adding tab 1: "${todoTitle}" (${ownerProds.length} total products consolidated)...`);
  const wsTodo = wb.addWorksheet(todoTitle);
  setupSheetHeaders(wsTodo);
  let todoRow = 4;
  for (const p of ownerProds) {
    writeProductRow(wsTodo, todoRow, p);
    todoRow++;
  }
  addTotalsRow(wsTodo, todoRow + 1, 4, todoRow - 1);

  // 2. CHRONOLOGICAL MONTH SHEETS AS SUBSEQUENT TABS (ONLY FOR THIS YEAR)
  for (const mName of ALL_MONTHS) {
    const monthProds = byMonth[mName];
    if (monthProds.length === 0) continue;

    console.log(`Adding tab: "${mName}" (${monthProds.length} products in ${year})...`);
    const ws = wb.addWorksheet(mName);
    setupSheetHeaders(ws);

    let rowIdx = 4;
    for (const p of monthProds) {
      writeProductRow(ws, rowIdx, p);
      rowIdx++;
    }
    addTotalsRow(ws, rowIdx + 1, 4, rowIdx - 1);
  }

  // Save to each target path
  for (const filePath of filePaths) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await wb.xlsx.writeFile(filePath);
    console.log(`✓ SUCCESS: Saved: ${filePath}`);
  }
}

async function main() {
  // 1. FABIO 2026 (Active root + 2026/ folder)
  await processWorkbook('fabio', 2026, [
    'COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx',
    'COMPRAS EBAY/COMPRAS EBAY FABIO/2026/Compras Ebay FABIO 2026.xlsx'
  ]);

  // 2. FABIO 2025 (Historical 2025/ folder + root 2025 file)
  await processWorkbook('fabio', 2025, [
    'COMPRAS EBAY/COMPRAS EBAY FABIO/2025/Compras Ebay FABIO 2025.xlsx',
    'COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO 2025.xlsx'
  ]);

  // 3. LILIANA 2026 (Active root + 2026/ folder)
  await processWorkbook('peggy', 2026, [
    'COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx',
    'COMPRAS EBAY/COMPRAS EBAY LILIANA/2026/Compras Ebay LILIANA 2026.xlsx'
  ]);

  // 4. LILIANA 2025 (Historical 2025/ folder + root 2025 file)
  await processWorkbook('peggy', 2025, [
    'COMPRAS EBAY/COMPRAS EBAY LILIANA/2025/Compras Ebay LILIANA 2025.xlsx',
    'COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA 2025.xlsx'
  ]);

  console.log('\n=== ALL WORKBOOKS SUCCESSFULLY GENERATED SEPARATED BY YEAR (2026 vs 2025) ===');
}

main().catch(console.error).finally(() => process.exit(0));
