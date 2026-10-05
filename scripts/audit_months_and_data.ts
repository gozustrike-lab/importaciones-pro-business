import * as ExcelJS from 'exceljs';
import { db } from '../src/lib/db';

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

async function audit() {
  const wbFabio = new ExcelJS.Workbook();
  await wbFabio.xlsx.readFile('COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx');
  console.log('FABIO sheets:', wbFabio.worksheets.map(w => w.name));

  const wbLiliana = new ExcelJS.Workbook();
  await wbLiliana.xlsx.readFile('COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx');
  console.log('LILIANA sheets:', wbLiliana.worksheets.map(w => w.name));

  const allProds = await db.product.findMany({
    orderBy: { purchaseDate: 'asc' }
  });

  const fabioByMonth: Record<string, any[]> = {};
  const peggyByMonth: Record<string, any[]> = {};

  for (const m of MONTH_NAMES) {
    fabioByMonth[m] = [];
    peggyByMonth[m] = [];
  }

  for (const p of allProds) {
    const isPeggy = (p.importerProfile || '').toLowerCase().includes('peggy') ||
                    (p.importerProfile || '').toLowerCase().includes('liliana') ||
                    (p.recipientName || '').toLowerCase().includes('peggy') ||
                    (p.recipientName || '').toLowerCase().includes('liliana');

    const d = p.purchaseDate || p.createdAt;
    const mName = MONTH_NAMES[d.getMonth()];

    if (isPeggy) {
      peggyByMonth[mName].push(p);
    } else {
      fabioByMonth[mName].push(p);
    }
  }

  console.log('\n--- DB Products Count per Month for FABIO ---');
  for (const m of MONTH_NAMES) {
    console.log(`  ${m.padEnd(12)}: ${fabioByMonth[m].length} products`);
  }

  console.log('\n--- DB Products Count per Month for PEGGY / LILIANA ---');
  for (const m of MONTH_NAMES) {
    console.log(`  ${m.padEnd(12)}: ${peggyByMonth[m].length} products`);
  }
}

audit().catch(console.error).finally(() => process.exit(0));
