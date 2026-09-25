import ExcelJS from 'exceljs';
import path from 'path';

async function checkTemplates() {
  const dir = path.join(process.cwd(), 'PLANTILLAS');
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.readFile(path.join(dir, 'SHIPER FORMATO ORDEN DE EMBARQUE ACTUALIZADO.xlsx'));
  console.log('=== SHIPER FORMATO ORDEN DE EMBARQUE ===');
  console.log('Worksheets:', wb1.worksheets.map(w => w.name));
  const ws1 = wb1.getWorksheet('ORDEN DE EMBARQUE') || wb1.worksheets[0];
  console.log('Filas 6 a 8:');
  for (let r = 6; r <= 8; r++) {
    const rowVals: string[] = [];
    for (let c = 1; c <= 12; c++) {
      rowVals.push(`${c}: ${ws1.getRow(r).getCell(c).value}`);
    }
    console.log(`Fila ${r}:`, rowVals.join(' | '));
  }

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(dir, 'FABIO Copia de FORMATO_TRADUCCION_DE_FACTURA.xlsx'));
  console.log('\n=== FORMATO TRADUCCION DE FACTURA ===');
  console.log('Worksheets:', wb2.worksheets.map(w => w.name));
  const ws2 = wb2.worksheets[0];
  console.log('Filas 1 a 6:');
  for (let r = 1; r <= 6; r++) {
    const rowVals: string[] = [];
    for (let c = 1; c <= 10; c++) {
      const v = ws2.getRow(r).getCell(c).value;
      if (v !== null && v !== undefined) {
        rowVals.push(`Col ${c}: ${JSON.stringify(v)}`);
      }
    }
    console.log(`Fila ${r}:`, rowVals.join(' | '));
  }
}

checkTemplates().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
