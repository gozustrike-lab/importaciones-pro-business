import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';

/**
 * Script para importar el historial completo de compras descargado de eBay (SAR / Reporte CSV)
 * Soporta archivos CSV exportados desde sarweb.ebay.com/sar o del reporte de compras de eBay.
 * 
 * Uso: npx tsx scripts/import_ebay_report.ts <ruta_al_archivo.csv>
 */
async function importEbayReport() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('Por favor indica la ruta del archivo CSV de eBay descargado.');
    console.log('Ejemplo: npx tsx scripts/import_ebay_report.ts C:\\Users\\fabio\\Downloads\\Reporte_eBay.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    console.log('El archivo CSV está vacío o no contiene filas de datos.');
    process.exit(1);
  }

  console.log(`Leídas ${lines.length - 1} filas del reporte de eBay.`);
  
  // Header detection
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  console.log('Columnas detectadas:', headers.slice(0, 10).join(', '));

  // Default tenant
  const user = await db.user.findFirst();
  const tenantId = user?.tenantId;

  if (!tenantId) {
    console.error('No se encontró un tenant configurado en la base de datos.');
    process.exit(1);
  }

  console.log(`Importando para el tenant: ${tenantId}...`);
  // Process lines
  let importedCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple CSV parser supporting quotes
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(rawLine)) !== null && matches.length < headers.length + 5) {
      let val = match[1] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val.trim());
      if (regex.lastIndex === 0) break;
    }

    if (matches.length < 3) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = matches[idx] || '';
    });

    // Detect fields
    const orderNumber = row['order number'] || row['order id'] || row['orderid'] || row['sales record number'] || `EBAY-HIST-${i}`;
    const description = row['item title'] || row['title'] || row['item description'] || row['description'] || 'Producto Histórico eBay';
    const priceStr = row['total price'] || row['item price'] || row['price'] || row['total'] || '0';
    const priceUsd = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 50;
    const trackingNumber = row['tracking number'] || row['tracking'] || '';
    const courier = row['carrier'] || row['shipping carrier'] || 'USPS';
    const dateStr = row['order date'] || row['sale date'] || row['date'] || row['creation date'];
    const purchaseDate = dateStr ? new Date(dateStr) : new Date(2026, 0, 1);
    const recipient = row['buyer name'] || row['recipient'] || row['ship to name'] || '';

    // SUNAT Profile detection
    const isPeggy = recipient.toLowerCase().includes('peggy') || recipient.toLowerCase().includes('liliana') || recipient.toLowerCase().includes('orduna');
    const importerProfile = isPeggy ? 'peggy' : 'fabio';

    // Check if exists
    const existing = await db.product.findFirst({
      where: {
        OR: [
          ...(trackingNumber ? [{ trackingId: trackingNumber }] : []),
          { orderNumber: orderNumber },
        ]
      }
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const exchangeRate = 3.40;
    await db.product.create({
      data: {
        tenantId,
        orderNumber,
        description,
        model: description.toLowerCase().includes('ipad') ? 'iPad' : (description.toLowerCase().includes('macbook') ? 'MacBook' : 'Electrónico'),
        category: 'Tecnología',
        condition: 'Usado',
        purchaseDate,
        supplier: 'eBay',
        courier,
        trackingId: trackingNumber,
        shippingStatus: 'Entregado',
        purchasePriceUsd: priceUsd,
        exchangeRate,
        totalCostPen: Math.round(priceUsd * exchangeRate * 100) / 100,
        importerProfile,
        recipientName: recipient,
        ebayAccount: 'gozustrike@gmail.com',
        isArchived: true, // Historical items are imported directly as archived
        notes: 'Importado de Historial General eBay (SAR / Reporte)',
      }
    });
    importedCount++;
  }

  console.log(`\n=== RESULTADO DE IMPORTACIÓN HISTÓRICA ===`);
  console.log(`Nuevos productos históricos importados a Archivados: ${importedCount}`);
  console.log(`Productos ya existentes omitidos (sin duplicar): ${skippedCount}`);
}

importEbayReport().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
