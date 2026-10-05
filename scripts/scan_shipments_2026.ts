import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

function getShipmentExcelFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getShipmentExcelFiles(full));
    } else if (item.toLowerCase().includes('orden de embarque') && item.endsWith('.xlsx')) {
      results.push(full);
    }
  }
  return results;
}

async function scanAllShipmentFiles() {
  console.log('=== SCANNING ALL ORDEN DE EMBARQUE FILES IN 2026 ===\n');

  const filesFabio = getShipmentExcelFiles('COMPRAS EBAY/COMPRAS EBAY FABIO/2026');
  const filesLiliana = getShipmentExcelFiles('COMPRAS EBAY/COMPRAS EBAY LILIANA/2026');

  console.log(`Found ${filesFabio.length} Orden de Embarque files for FABIO 2026.`);
  console.log(`Found ${filesLiliana.length} Orden de Embarque files for LILIANA 2026.`);

  const scanFile = async (fPath: string) => {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(fPath);
      const ws = wb.getWorksheet('ORDEN DE EMBARQUE') || wb.worksheets[0];
      if (!ws) return [];
      const orders: any[] = [];
      for (let r = 8; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const colTracking = String(row.getCell(6).value || '').trim();
        const colFactura = String(row.getCell(13).value || '').trim();
        const colDesc = String(row.getCell(7).value || '').trim();
        const colVal = row.getCell(9).value;
        if (colTracking || colFactura) {
          orders.push({
            file: path.relative(process.cwd(), fPath),
            tracking: colTracking,
            factura: colFactura,
            desc: colDesc,
            val: colVal
          });
        }
      }
      return orders;
    } catch (e: any) {
      return [];
    }
  };

  let totalFabioOrders = 0;
  for (const f of filesFabio) {
    const ords = await scanFile(f);
    if (ords.length > 0) {
      console.log(`Fabio: ${path.basename(path.dirname(f))} / ${path.basename(f)} -> ${ords.length} items`);
      totalFabioOrders += ords.length;
    }
  }

  let totalLilianaOrders = 0;
  for (const f of filesLiliana) {
    const ords = await scanFile(f);
    if (ords.length > 0) {
      console.log(`Liliana: ${path.basename(path.dirname(f))} / ${path.basename(f)} -> ${ords.length} items`);
      totalLilianaOrders += ords.length;
    }
  }

  console.log(`\nTotal items across 2026 shipment files: Fabio = ${totalFabioOrders}, Liliana = ${totalLilianaOrders}`);
}

scanAllShipmentFiles().catch(console.error);
