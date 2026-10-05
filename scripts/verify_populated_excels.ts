import * as ExcelJS from 'exceljs';

async function verify() {
  const files = [
    { name: 'FABIO 2026', path: 'COMPRAS EBAY/COMPRAS EBAY FABIO/Compras Ebay FABIO.xlsx', expectedYear: 2026 },
    { name: 'FABIO 2025', path: 'COMPRAS EBAY/COMPRAS EBAY FABIO/2025/Compras Ebay FABIO 2025.xlsx', expectedYear: 2025 },
    { name: 'LILIANA 2026', path: 'COMPRAS EBAY/COMPRAS EBAY LILIANA/Compras Ebay LILIANA.xlsx', expectedYear: 2026 },
    { name: 'LILIANA 2025', path: 'COMPRAS EBAY/COMPRAS EBAY LILIANA/2025/Compras Ebay LILIANA 2025.xlsx', expectedYear: 2025 }
  ];

  for (const f of files) {
    console.log(`\n=================== VERIFYING ${f.name} ===================`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(f.path);

    wb.worksheets.forEach(ws => {
      let items = 0;
      let withItemLink = 0;
      let withSupplierLink = 0;
      let withOrderLink = 0;
      let yearMismatch = 0;

      for (let r = 4; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const ordVal = row.getCell(5).value;
        const ord = ordVal && typeof ordVal === 'object' && 'text' in ordVal ? ordVal.text : String(ordVal || '').trim();
        if (ord && (ord.includes('-') || /^\d{10,}$/.test(ord))) {
          items++;

          // Check date year
          const dateStr = String(row.getCell(2).value || '');
          if (!dateStr.includes(String(f.expectedYear))) {
            yearMismatch++;
          }

          // Check order link
          if (ordVal && typeof ordVal === 'object' && 'hyperlink' in ordVal) withOrderLink++;

          // Check supplier link
          const sVal = row.getCell(9).value;
          if (sVal && typeof sVal === 'object' && 'hyperlink' in sVal) withSupplierLink++;

          // Check description item link
          const dVal = row.getCell(10).value;
          if (dVal && typeof dVal === 'object' && 'hyperlink' in dVal) withItemLink++;
        }
      }

      console.log(`Sheet "${ws.name.padEnd(12)}": ${items} items | OrderLinks: ${withOrderLink} | ItemLinks: ${withItemLink} | SupplierLinks: ${withSupplierLink} | YearMismatch: ${yearMismatch}`);
    });
  }
}

verify().catch(console.error).finally(() => process.exit(0));
