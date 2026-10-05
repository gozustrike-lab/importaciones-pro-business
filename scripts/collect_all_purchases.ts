import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';

interface ParsedItem {
  sourceFile: string;
  owner: 'fabio' | 'peggy';
  year: number;
  monthName: string;
  orderNumber: string;
  tracking: string;
  shipperTracking?: string;
  courier: string;
  supplier: string;
  description: string;
  priceUsd: number;
  dateStr?: string;
  itemId?: string;
  model?: string;
}

const SPANISH_MONTH_MAP: Record<string, string> = {
  'enero': 'ENERO',
  'febrero': 'FEBRERO',
  'frebrero': 'FEBRERO',
  'marzo': 'MARZO',
  'abril': 'ABRIL',
  'mayo': 'MAYO',
  'junio': 'JUNIO',
  'julio': 'JULIO',
  'agosto': 'AGOSTO',
  'setiembre': 'SEPTIEMBRE',
  'septiembre': 'SEPTIEMBRE',
  'octubre': 'OCTUBRE',
  'noviembre': 'NOVIEMBRE',
  'diciembre': 'DICIEMBRE'
};

function getAllExcelFiles(dir: string): string[] {
  let res: string[] = [];
  if (!fs.existsSync(dir)) return res;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      res = res.concat(getAllExcelFiles(full));
    } else if (item.endsWith('.xlsx') && !item.startsWith('~$') && !item.includes('Compras Ebay')) {
      res.push(full);
    }
  }
  return res;
}

async function collectAll() {
  console.log('=== COLLECTING ALL PURCHASES ACROSS SYSTEM ===\n');

  const allShipmentFiles = [
    ...getAllExcelFiles('COMPRAS EBAY/COMPRAS EBAY FABIO'),
    ...getAllExcelFiles('COMPRAS EBAY/COMPRAS EBAY LILIANA')
  ];

  console.log(`Found ${allShipmentFiles.length} shipment / translation Excel files.`);

  const collected: ParsedItem[] = [];

  for (const f of allShipmentFiles) {
    const isLiliana = f.toLowerCase().includes('liliana') || f.toLowerCase().includes('peggy');
    const owner: 'fabio' | 'peggy' = isLiliana ? 'peggy' : 'fabio';

    // deduce year and month from path
    const yearMatch = f.match(/202[456]/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : 2026;

    let monthName = 'SEPTIEMBRE';
    for (const [k, v] of Object.entries(SPANISH_MONTH_MAP)) {
      if (f.toLowerCase().includes(k)) {
        monthName = v;
        break;
      }
    }

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(f);

      // Check if it's an ORDEN DE EMBARQUE
      const wsEmbarque = wb.getWorksheet('ORDEN DE EMBARQUE') || wb.worksheets.find(w => w.name.toUpperCase().includes('EMBARQUE'));
      if (wsEmbarque) {
        for (let r = 8; r <= wsEmbarque.rowCount; r++) {
          const row = wsEmbarque.getRow(r);
          const colTrack = String(row.getCell(6).value || '').trim();
          const colOrd = String(row.getCell(13).value || '').trim();
          const colDesc = String(row.getCell(7).value || '').trim();
          const colVal = parseFloat(String(row.getCell(9).value || '0')) || 0;
          const colCourier = String(row.getCell(5).value || 'USPS').trim();
          const colSupplier = String(row.getCell(2).value || 'eBay').trim();

          if (colOrd && (colOrd.includes('-') || /^\d{10,}$/.test(colOrd))) {
            collected.push({
              sourceFile: path.relative(process.cwd(), f),
              owner,
              year,
              monthName,
              orderNumber: colOrd,
              tracking: colTrack,
              courier: colCourier,
              supplier: colSupplier,
              description: colDesc,
              priceUsd: colVal,
            });
          }
        }
      }

      // Check if it's TRADUCCION DE FACTURA
      const wsTraduccion = wb.getWorksheet('Hoja1') || wb.worksheets[0];
      if (wsTraduccion && wsTraduccion.name !== 'ORDEN DE EMBARQUE') {
        for (let r = 5; r <= wsTraduccion.rowCount; r++) {
          const row = wsTraduccion.getRow(r);
          const colDesc = String(row.getCell(3).value || '').trim();
          const colModel = String(row.getCell(5).value || '').trim();
          // let's see if this has tracking or order
        }
      }
    } catch (e: any) {
      // ignore corrupt files
    }
  }

  console.log(`Parsed ${collected.length} raw purchase records from shipment files.`);

  // Group by unique orderNumber
  const uniqueOrders: Record<string, ParsedItem> = {};
  for (const it of collected) {
    if (!uniqueOrders[it.orderNumber]) {
      uniqueOrders[it.orderNumber] = it;
    }
  }

  console.log(`Unique orders from shipment files: ${Object.keys(uniqueOrders).length}`);

  // Compare with DB
  const dbProds = await db.product.findMany();
  const dbOrderMap = new Map(dbProds.map(p => [p.orderNumber, p]));

  let inDbCount = 0;
  let notInDbCount = 0;
  const notInDbList: ParsedItem[] = [];

  for (const ord of Object.keys(uniqueOrders)) {
    if (dbOrderMap.has(ord)) {
      inDbCount++;
    } else {
      notInDbCount++;
      notInDbList.push(uniqueOrders[ord]);
    }
  }

  console.log(`Orders already in DB: ${inDbCount}`);
  console.log(`Orders NOT in DB: ${notInDbCount}`);
  if (notInDbCount > 0) {
    console.log('Sample not in DB:', JSON.stringify(notInDbList.slice(0, 10), null, 2));
  }
}

collectAll().catch(console.error);
