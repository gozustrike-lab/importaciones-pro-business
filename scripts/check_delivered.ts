import { db } from '../src/lib/db';

async function main() {
  const activeProds = await db.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'asc' },
  });

  const archivedProds = await db.product.findMany({
    where: { isArchived: true },
    orderBy: { purchaseDate: 'asc' },
  });

  console.log(`\n=== PRODUCTOS ACTIVOS EN DB (${activeProds.length}) ===`);
  for (let i = 0; i < activeProds.length; i++) {
    const p = activeProds[i];
    const delivered = p.actualArrival ? `Entregado Miami: ${p.actualArrival.toISOString().slice(0, 10)}` : 'En Tránsito';
    console.log(`${i + 1}. [${p.orderNumber}] | ${p.purchaseDate.toISOString().slice(0, 10)} | Status: ${p.shippingStatus} | ${delivered} | Courier: ${p.courier} | Tracking: ${p.trackingId || 'SIN_TRACKING'} | ${p.importerProfile} | $${p.purchasePriceUsd} | ${p.description.slice(0, 40)}`);
  }

  console.log(`\n=== PRODUCTOS ARCHIVADOS EN DB (${archivedProds.length}) ===`);
  for (let i = 0; i < archivedProds.length; i++) {
    const p = archivedProds[i];
    const delivered = p.actualArrival ? `Entregado Miami: ${p.actualArrival.toISOString().slice(0, 10)}` : 'Sin fecha llegada';
    console.log(`${i + 1}. [${p.orderNumber}] | ${p.purchaseDate.toISOString().slice(0, 10)} | Status: ${p.shippingStatus} | ${delivered} | Courier: ${p.courier} | Tracking: ${p.trackingId || 'SIN_TRACKING'} | ${p.importerProfile} | $${p.purchasePriceUsd} | ${p.description.slice(0, 40)}`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
