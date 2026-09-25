import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('PLANTILLAS/COMPRAS EBAY - CONTABILIDAD - COSTOS - VENTAS.xlsx');

  console.log('Worksheet summary:');
  for (const ws of wb.worksheets) {
    console.log(`\n=== SHEET: ${ws.name} ===`);
    const headerRow = ws.getRow(3);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (c, col) => {
      headers.push(`[${col}] ${c.value || ''}`);
    });
    console.log('Headers (Row 3):', headers.filter(h => !h.endsWith(' ')).slice(0, 15).join(' | '));

    let count = 0;
    const sampleRows: any[] = [];
    for (let r = 4; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const fecha = row.getCell(2).value;
      const orden = row.getCell(5).value;
      const desc = row.getCell(9).value;
      const precio = row.getCell(10).value;
      if (fecha || orden || desc) {
        count++;
        if (sampleRows.length < 2) {
          sampleRows.push({
            row: r,
            fecha: typeof fecha === 'object' ? JSON.stringify(fecha) : fecha,
            orden,
            desc: typeof desc === 'object' ? (desc as any)?.text || JSON.stringify(desc) : desc,
            precio: typeof precio === 'object' ? JSON.stringify(precio) : precio
          });
        }
      }
    }
    console.log(`Total valid data rows: ${count}`);
    console.log('Sample rows:', sampleRows);
  }
}

main().catch(console.error).finally(() => process.exit(0));
