import { db } from '../src/lib/db';

async function main() {
  const prods = await db.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'asc' }
  });
  console.log('--- 31 PRODUCTOS ACTIVOS EN ORDEN CRONOLÓGICO ---');
  prods.forEach((p, idx) => {
    console.log(`${idx + 1}. Ord: ${p.orderNumber} | Date: ${p.purchaseDate.toISOString().slice(0, 10)} | Status: ${p.shippingStatus} | ${p.importerProfile} | $${p.purchasePriceUsd} | ${p.description.slice(0, 50)}`);
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
