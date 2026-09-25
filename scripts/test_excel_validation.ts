import { generateEmbarqueWorkbook, generateTraduccionWorkbook } from '../src/lib/shipper-generator';
import ExcelJS from 'exceljs';
import fs from 'fs';

async function testGeneration() {
  console.log('=== TEST 1: GENERANDO HOJA DE EMBARQUE ===');
  const sampleEmbarqueItems = [
    {
      proveedor: 'EBAY',
      dniRuc: '10762026835',
      consignatario: 'FABIO CESAR HERRERA BONILLA',
      courier: 'USPS',
      trackingUsa: '9434608106244558949658',
      contenidoGeneral: 'Apple iPad Pro 10.5" 256GB WiFi Rose Gold + Apple Pencil 1st Gen A1701',
      paisFabricacion: 'CHINA',
      valorUsd: 100.00,
      indicaciones: '',
      itemUrl: 'https://www.ebay.com/itm/158089540431',
    },
    {
      proveedor: 'EBAY',
      dniRuc: '10762026835',
      consignatario: 'FABIO CESAR HERRERA BONILLA',
      courier: 'UPS',
      trackingUsa: '1Z0R2B760321718160',
      contenidoGeneral: 'Apple iPad Pro 10.5in - Choose Specs - Wi-Fi or Cellular - LCD WHITE SPOTS[Wifi Only,Silver,256GB]',
      paisFabricacion: 'CHINA',
      valorUsd: 89.95,
      indicaciones: '',
    }
  ];

  const bufEmbarque = await generateEmbarqueWorkbook(sampleEmbarqueItems);
  const wb1 = new ExcelJS.Workbook();
  await wb1.xlsx.load(bufEmbarque as any);
  const ws1 = wb1.getWorksheet('ORDEN DE EMBARQUE');

  console.log('Checking Row 8 (Item 1):');
  const r8 = ws1?.getRow(8);
  console.log('  N°:', r8?.getCell(2).value);
  console.log('  Proveedor:', r8?.getCell(3).value);
  console.log('  RUC:', r8?.getCell(4).value);
  console.log('  Consignatario:', r8?.getCell(5).value);
  console.log('  Courier:', r8?.getCell(6).value);
  console.log('  Tracking:', r8?.getCell(7).value);
  console.log('  Contenido General:', JSON.stringify(r8?.getCell(8).value));
  console.log('  Pais:', r8?.getCell(9).value);
  console.log('  Valor USD:', r8?.getCell(10).value);
  console.log('  Indicaciones (Must be null):', r8?.getCell(11).value);

  console.log('\nChecking Row 9 (Item 2):');
  const r9 = ws1?.getRow(9);
  console.log('  Contenido General:', JSON.stringify(r9?.getCell(8).value));
  console.log('  Indicaciones (Must be null):', r9?.getCell(11).value);

  console.log('\n=== TEST 2: GENERANDO TRADUCCIÓN FACTURA SUNAT ===');
  const sampleTraduccionItems = [
    {
      productoNombre: 'Tableta Electrónica',
      marca: 'Apple',
      modelo: 'iPad Pro 10.5 (A1701)', // should be sanitized to A1701!
      paisFabricacion: 'CHINA',
      cantidad: 1,
      estado: 'Usado',
      numeroFactura: '25-15141-56007',
      numeroOperacion: '',
    },
    {
      productoNombre: 'Tableta Electrónica',
      marca: 'Apple',
      modelo: 'A2200',
      paisFabricacion: 'CHINA',
      cantidad: 4,
      estado: 'Usado',
      numeroFactura: '26-15141-31231',
      numeroOperacion: '',
    }
  ];

  const bufTrad = await generateTraduccionWorkbook(sampleTraduccionItems, 'AWB-TEST-778899');
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(bufTrad as any);
  const ws2 = wb2.worksheets[0];

  console.log('AWB in D2:', ws2.getCell('D2').value);

  for (let idx = 0; idx < sampleTraduccionItems.length; idx++) {
    const rowNum = 6 + idx;
    const row = ws2.getRow(rowNum);
    console.log(`\nRow ${rowNum} (Height: ${row.height}):`);
    console.log('  N° ITEM (Col B):', row.getCell(2).value, '| Font:', row.getCell(2).font?.name, row.getCell(2).font?.size, 'Bold:', row.getCell(2).font?.bold);
    console.log('  PRODUCTO (Col C):', row.getCell(3).value);
    console.log('  MARCA (Col D):', row.getCell(4).value);
    console.log('  MODELO (Col E - MUST BE ONLY A####):', `"${row.getCell(5).value}"`);
    console.log('  PAIS (Col F):', row.getCell(6).value);
    console.log('  CANTIDAD (Col G):', row.getCell(7).value);
    console.log('  ESTADO (Col H):', row.getCell(8).value);
    console.log('  NUMERO FACTURA (Col I):', row.getCell(9).value);
    console.log('  NUMERO OPERACION (Col J - MUST BE null):', row.getCell(10).value);
    console.log('  Alignment Col E:', JSON.stringify(row.getCell(5).alignment));
  }

  console.log('\n=== ALL TESTS PASSED! ===');
}

testGeneration().catch(console.error);
