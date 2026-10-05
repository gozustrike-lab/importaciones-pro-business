import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';

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

async function verifyAllShipmentItemsAgainstDb() {
  const dbProducts = await db.product.findMany();
  const dbOrders = new Set(dbProducts.map(p => p.orderNumber.trim()));
  const dbTrackings = new Set(dbProducts.map(p => (p.trackingId || '').trim()).filter(Boolean));

  console.log(`DB has ${dbProducts.length} products. Checking 2026 shipment files...`);

  const filesFabio = getShipmentExcelFiles('COMPRAS EBAY/COMPRAS EBAY FABIO/2026');
  const filesLiliana = getShipmentExcelFiles('COMPRAS EBAY/COMPRAS EBAY LILIANA/2026');

  const checkFiles = async (files: string[], owner: string) => {
    let missing: any[] = [];
    for (const f of files) {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(f);
        const ws = wb.getWorksheet('ORDEN DE EMBARQUE') || wb.worksheets.find(w => w.name.toUpperCase().includes('EMBARQUE'));
        if (!ws) continue;
        for (let r = 8; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const track = String(row.getCell(6).value || row.getCell(7).value || '').trim();
          const descCell = row.getCell(7).value || row.getCell(8).value;
          const desc = typeof descCell === 'object' && 'text' in (descCell as any) ? (descCell as any).text : String(descCell || '').trim();
          const link = typeof descCell === 'object' && 'hyperlink' in (descCell as any) ? (descCell as any).hyperlink : '';
          const val = row.getCell(9).value || row.getCell(10).value;
          
          if (track && track.length >= 8 && !track.toUpperCase().includes('TRACKING')) {
            // Check if in DB
            const inDb = dbTrackings.has(track);
            if (!inDb) {
              missing.push({
                owner,
                file: path.relative(process.cwd(), f),
                track,
                desc,
                link,
                val
              });
            }
          }
        }
      } catch (e) {}
    }
    return missing;
  };

  const missingFabio = await checkFiles(filesFabio, 'FABIO');
  const missingLiliana = await checkFiles(filesLiliana, 'LILIANA');

  console.log(`Shipment items NOT in DB: Fabio = ${missingFabio.length}, Liliana = ${missingLiliana.length}`);
  if (missingFabio.length > 0) {
    console.log('Sample missing Fabio:', JSON.stringify(missingFabio.slice(0, 5), null, 2));
  }
  if (missingLiliana.length > 0) {
    console.log('Sample missing Liliana:', JSON.stringify(missingLiliana.slice(0, 5), null, 2));
  }
}

verifyAllShipmentItemsAgainstDb().catch(console.error).finally(() => process.exit(0));
