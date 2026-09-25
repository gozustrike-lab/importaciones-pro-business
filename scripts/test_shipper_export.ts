import { generateEmbarqueWorkbook, generateTraduccionWorkbook, autoClassifyProduct } from '../src/lib/shipper-generator';
import * as fs from 'fs';
import * as path from 'path';

async function testExport() {
  console.log('Probando generación de Excel de Embarque y Traducción...');

  const sampleProducts = [
    {
      description: 'Apple iPad Pro 10.5in - Choose Specs - Wi-Fi or Cellular - LCD WHITE SPOTS[Wifi Only,Silver,256GB]',
      purchasePriceUsd: 89.95,
      courier: 'UPS',
      trackingId: '1Z0R2B760321718160',
      orderNumber: '18-15136-37713',
      quantity: 1,
      model: 'A1701',
      condition: 'Usado',
    },
    {
      description: 'MacBook Pro 13" 2019 | i5-8279U | 16GB RAM | 256GB NVMe | 589 Cycles | READ',
      purchasePriceUsd: 200.0,
      courier: 'FEDEX',
      trackingId: '383772352970',
      orderNumber: '22-15154-01688',
      quantity: 1,
      model: 'A2159 (MacBook Pro 13")',
      condition: 'Usado',
    },
  ];

  // 1. Embarque
  const embarqueItems = sampleProducts.map(p => ({
    proveedor: 'EBAY',
    dniRuc: '10762026835',
    consignatario: 'FABIO CESAR HERRERA BONILLA',
    courier: p.courier,
    trackingUsa: p.trackingId,
    contenidoGeneral: `${p.model} - ${p.description.slice(0, 40)} (Usado)`,
    paisFabricacion: 'CHINA',
    valorUsd: p.purchasePriceUsd,
    indicaciones: `Modelo: ${p.model}`,
  }));

  const embarqueBuf = await generateEmbarqueWorkbook(embarqueItems, {
    ruc: '10762026835',
    name: 'FABIO CESAR HERRERA BONILLA',
  });
  console.log('✓ Hoja de Embarque generada, bytes:', embarqueBuf.length);

  // 2. Traducción
  const traduccionItems = sampleProducts.map(p => {
    const classified = autoClassifyProduct(p);
    return {
      ...classified,
      modelo: p.model,
    };
  });

  const traduccionBuf = await generateTraduccionWorkbook(traduccionItems, 'AWB-TEST-123');
  console.log('✓ Hoja de Traducción generada, bytes:', traduccionBuf.length);
}

testExport().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
