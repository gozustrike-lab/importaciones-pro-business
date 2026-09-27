import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { db } from '../src/lib/db';

export async function syncComprasEbay() {
  console.log('=== INICIANDO SINCRONIZACIÓN COMPRAS EBAY & BOLETAS DE VENTA ===');

  const pythonScript = path.join(process.cwd(), 'scripts', 'parse_compras_ebay.py');
  const jsonOutput = path.join(process.cwd(), 'scripts', 'parsed_data.json');

  // 1. Run Python Parser
  console.log('1. Ejecutando escaneo profundo de COMPRAS EBAY (Excel + Boletas PDF)...');
  try {
    execSync(`python "${pythonScript}" "${jsonOutput}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Error ejecutando parser Python:', err);
    throw err;
  }

  // 2. Read parsed data
  if (!fs.existsSync(jsonOutput)) {
    throw new Error('No se generó el archivo parsed_data.json');
  }

  const raw = fs.readFileSync(jsonOutput, 'utf-8');
  const data = JSON.parse(raw);
  const sales: any[] = data.sales || [];
  const purchases: any[] = data.purchases || [];

  console.log(`2. Datos leídos: ${sales.length} períodos de ventas y ${purchases.length} compras.`);

  // 3. Get default tenant
  const tenant = await db.tenant.findFirst();
  if (!tenant) {
    throw new Error('No se encontró ningún Tenant en la base de datos');
  }
  const tenantId = tenant.id;

  // 4. Sync Sales into MonthlySales
  console.log('3. Sincronizando ventas reales en MonthlySales...');
  let salesUpdated = 0;
  for (const s of sales) {
    const monthKey = `${s.monthKey}-${s.importerKey}`;
    const existing = await db.monthlySales.findFirst({
      where: {
        tenantId,
        month: monthKey,
      },
    });

    const note = `Ventas reales SUNAT: ${s.boletasCount} boletas electrónicas (${s.importerKey.toUpperCase()})`;

    if (existing) {
      await db.monthlySales.update({
        where: { id: existing.id },
        data: {
          totalSalesPen: s.totalSalesPen,
          notes: note,
        },
      });
    } else {
      await db.monthlySales.create({
        data: {
          tenantId,
          month: monthKey,
          totalSalesPen: s.totalSalesPen,
          notes: note,
        },
      });
    }
    salesUpdated++;
  }
  console.log(`   ✓ ${salesUpdated} meses de ventas sincronizados.`);

  // 5. Sync Purchases into Product
  console.log('4. Sincronizando compras reales de eBay en Product...');
  let purchasesCreated = 0;
  let purchasesUpdated = 0;

  for (const p of purchases) {
    if (!p.orderNumber || p.orderNumber.startsWith('ORD-')) {
      continue;
    }

    const existingProd = await db.product.findFirst({
      where: {
        tenantId,
        orderNumber: p.orderNumber,
      },
    });

    if (existingProd) {
      await db.product.update({
        where: { id: existingProd.id },
        data: {
          importerProfile: p.importerProfile,
          purchasePriceUsd: p.purchasePriceUsd,
          totalCostPen: p.totalCostPen,
          trackingId: p.trackingId || existingProd.trackingId,
          courier: p.courier || existingProd.courier,
          supplier: p.supplier || existingProd.supplier,
        },
      });
      purchasesUpdated++;
    } else {
      await db.product.create({
        data: {
          tenantId,
          orderNumber: p.orderNumber,
          description: p.description,
          purchasePriceUsd: p.purchasePriceUsd,
          totalCostPen: p.totalCostPen,
          importerProfile: p.importerProfile,
          purchaseDate: new Date(p.purchaseDate),
          courier: p.courier,
          trackingId: p.trackingId,
          supplier: p.supplier,
          category: p.description.toLowerCase().includes('macbook') || p.description.toLowerCase().includes('laptop') || p.description.toLowerCase().includes('thinkbook') ? 'Laptops' : 'Tablets',
          shippingStatus: 'ENTREGADO_MIAMI',
          estimatedArrival: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          condition: 'Usado',
        },
      });
      purchasesCreated++;
    }
  }

  console.log(`   ✓ Compras: ${purchasesCreated} creadas, ${purchasesUpdated} actualizadas.`);
  console.log('=== SINCRONIZACIÓN COMPLETADA CON ÉXITO ===');

  return {
    salesUpdated,
    purchasesCreated,
    purchasesUpdated,
    totalSalesMonths: sales.length,
    totalPurchases: purchases.length,
  };
}

// Allow direct CLI execution: npx tsx scripts/sync-compras-ebay.ts
if (require.main === module) {
  syncComprasEbay()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
