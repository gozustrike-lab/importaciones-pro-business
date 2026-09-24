import { db } from '../src/lib/db';

async function main() {
  const shipments = await db.shipment.findMany({
    include: { products: true }
  });
  console.log(`Shipments count: ${shipments.length}`);
  for (const s of shipments) {
    console.log(`Shipment: ${s.code} | Status: ${s.status} | Consignee: ${s.consigneeName} | Products count: ${s.products.length}`);
    for (const p of s.products) {
      console.log(`  -> Product ID: ${p.id} | Order: ${p.orderNumber} | Archived: ${p.isArchived} | Desc: ${p.description.slice(0, 45)}`);
    }
  }

  const products = await db.product.findMany({
    orderBy: { purchaseDate: 'desc' },
  });

  console.log(`Total productos: ${products.length}`);
  const orderCounts: Record<string, number> = {};
  for (const p of products) {
    orderCounts[p.orderNumber] = (orderCounts[p.orderNumber] || 0) + 1;
  }

  console.log('\n--- ÓRDENES DUPLICADAS O MULTI-ITEM ---');
  for (const [orderNumber, count] of Object.entries(orderCounts)) {
    if (count > 1) {
      console.log(`Orden ${orderNumber}: ${count} registros`);
      const matches = products.filter(p => p.orderNumber === orderNumber);
      matches.forEach(m => {
        console.log(`  ID: ${m.id} | Desc: ${m.description.slice(0, 40)} | Tracking: ${m.trackingId} | USD: ${m.purchasePriceUsd} | Ship: ${m.shippingCostUsd} | Importer: ${m.importerProfile} | Archived: ${m.isArchived}`);
      });
    }
  }

  console.log('\n--- TODOS LOS PRODUCTOS ---');
  for (const p of products) {
    console.log(`[${p.orderNumber}] | ${p.importerProfile} | Item: $${p.purchasePriceUsd} | Ship: $${p.shippingCostUsd} | Total: $${(p.purchasePriceUsd + p.shippingCostUsd).toFixed(2)} | Date: ${p.purchaseDate.toISOString().slice(0, 10)} | Archived: ${p.isArchived} | Desc: ${p.description.slice(0, 35)}...`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
