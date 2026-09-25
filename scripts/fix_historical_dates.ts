import ExcelJS from 'exceljs';
import path from 'path';
import { db } from '../src/lib/db';

function parseAnyDate(dateStr: string, sheetName: string): Date {
  if (!dateStr || dateStr.trim().length === 0) {
    return new Date(2025, 6, 15);
  }

  // 1. Try removing "at" or "a las"
  const cleanStr = dateStr.replace(/\s+at\s+/i, ' ').replace(/\s+a las\s+/i, ' ').trim();
  const d1 = new Date(cleanStr);
  if (!isNaN(d1.getTime())) return d1;

  // 2. Spanish parsing: "1 de julio de 2025 12:16" or "1 de julio 12:16"
  const months: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  // Determine year: ENERO & FEBRERO in this template are 2026, rest are 2025
  let year = 2025;
  if (/2026/i.test(dateStr)) year = 2026;
  else if (/2025/i.test(dateStr)) year = 2025;
  else if (['ENERO', 'FEBRERO'].includes(sheetName)) year = 2026;
  else year = 2025;

  const defaultMonthIdx = months[sheetName.toLowerCase()] ?? 0;

  // 1. Spanish Pattern: "5 de abril de 2025" or "1 de julio a las 12:16"
  const spanishPattern = dateStr.match(/(\d{1,2})\s+de\s+([a-zA-Z]+)(?:\s+de\s+(\d{4}))?/i);
  if (spanishPattern) {
    const day = parseInt(spanishPattern[1], 10);
    const mStr = spanishPattern[2].toLowerCase();
    const mIdx = months[mStr] !== undefined ? months[mStr] : defaultMonthIdx;
    if (spanishPattern[3]) year = parseInt(spanishPattern[3], 10);
    return new Date(year, mIdx, day, 12, 0, 0);
  }

  // 2. English Pattern: "Jul 7, 2025" or "July 7, 2025"
  const englishPattern = dateStr.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (englishPattern) {
    const mStr = englishPattern[1].toLowerCase();
    const day = parseInt(englishPattern[2], 10);
    const mIdx = months[mStr] !== undefined ? months[mStr] : defaultMonthIdx;
    if (englishPattern[3]) year = parseInt(englishPattern[3], 10);
    return new Date(year, mIdx, day, 12, 0, 0);
  }

  // 3. Just extract day if present, e.g. "15" or fallback
  const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;
  return new Date(year, defaultMonthIdx, Math.min(day, 28), 12, 0, 0);
}

async function main() {
  const filePath = path.join(process.cwd(), 'PLANTILLAS', 'COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const importedProds = await db.product.findMany({
    where: { notes: { startsWith: 'Importado de Excel' } },
  });

  console.log(`Productos importados para corregir fecha: ${importedProds.length}`);

  let updated = 0;
  for (const p of importedProds) {
    // Extract sheet and row from notes: "Importado de Excel hoja JULIO fila 14"
    const m = p.notes.match(/hoja\s+([a-zA-Z]+)\s+fila\s+(\d+)/i);
    if (!m) continue;

    const sheetName = m[1].toUpperCase();
    const rowNum = parseInt(m[2], 10);

    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const cellVal = ws.getRow(rowNum).getCell(2).value;
    const dateStr = cellVal ? String(cellVal).trim() : '';

    const realDate = parseAnyDate(dateStr, sheetName);

    await db.product.update({
      where: { id: p.id },
      data: { purchaseDate: realDate },
    });
    updated++;
  }

  console.log(`✓ Fechas corregidas exitosamente: ${updated}`);

  // Summary by year
  const allProds = await db.product.findMany({ select: { purchaseDate: true } });
  const counts: Record<string, number> = {};
  for (const pr of allProds) {
    const y = pr.purchaseDate.getFullYear();
    counts[y] = (counts[y] || 0) + 1;
  }
  console.log('Distribución exacta por año en BD:', counts);
}

main().catch(console.error).finally(() => process.exit(0));
