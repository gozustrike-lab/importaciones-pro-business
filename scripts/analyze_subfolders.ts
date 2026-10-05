import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

function findExcelFiles(dir: string, fileList: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findExcelFiles(full, fileList);
    } else if (item.endsWith('.xlsx') && !item.startsWith('~$')) {
      fileList.push(full);
    }
  }
  return fileList;
}

async function analyzeAllSubfolderExcels() {
  console.log('=== ANALYZING ALL EXCEL FILES IN COMPRAS EBAY FOLDERS ===\n');

  const baseFabio = path.join(process.cwd(), 'COMPRAS EBAY', 'COMPRAS EBAY FABIO');
  const baseLiliana = path.join(process.cwd(), 'COMPRAS EBAY', 'COMPRAS EBAY LILIANA');

  const fabioFiles = findExcelFiles(baseFabio).filter(f => !f.includes('Compras Ebay FABIO.xlsx'));
  const lilianaFiles = findExcelFiles(baseLiliana).filter(f => !f.includes('Compras Ebay LILIANA.xlsx'));

  console.log(`Found ${fabioFiles.length} auxiliary Excel files in FABIO folders.`);
  console.log(`Found ${lilianaFiles.length} auxiliary Excel files in LILIANA folders.`);

  // Let's inspect some of these files to see what information they hold
  const sampleFiles = [...fabioFiles.slice(0, 5), ...lilianaFiles.slice(0, 5)];
  for (const sf of sampleFiles) {
    console.log(`\nInspecting: ${path.relative(process.cwd(), sf)}`);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(sf);
      wb.worksheets.forEach(ws => {
        console.log(`  Sheet "${ws.name}": ${ws.rowCount} rows`);
        // print row 1 to 5 values
        for (let r = 1; r <= Math.min(ws.rowCount, 4); r++) {
          const vals: any[] = [];
          for (let c = 1; c <= 12; c++) {
            const v = ws.getRow(r).getCell(c).value;
            if (v) vals.push(`C${c}: ${typeof v === 'object' && 'text' in v ? (v as any).text : v}`);
          }
          if (vals.length > 0) console.log(`    R${r}: ${vals.slice(0, 6).join(' | ')}`);
        }
      });
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

analyzeAllSubfolderExcels().catch(console.error);
