import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total products in DB:', products.length);
  const active = products.filter(p => !p.isArchived);
  console.log('Active products in DB:', active.length);
  const archived = products.filter(p => p.isArchived);
  console.log('Archived products in DB:', archived.length);
  
  console.log('\n--- Active by Status ---');
  const byStatus = active.reduce((acc, p) => { acc[p.shippingStatus] = (acc[p.shippingStatus] || 0) + 1; return acc; }, {} as any);
  console.log(byStatus);

  console.log('\n--- Active by ImporterProfile ---');
  const byPerson = active.reduce((acc, p) => { acc[p.importerProfile || 'UNASSIGNED'] = (acc[p.importerProfile || 'UNASSIGNED'] || 0) + 1; return acc; }, {} as any);
  console.log(byPerson);

  console.log('\n--- Active Products List ---');
  for (const p of active) {
    console.log(`[${p.shippingStatus}] [${p.importerProfile}] Ord: ${p.orderNumber} | Trk: ${p.trackingId || 'NONE'} | ShiperTrk: ${p.shipperTracking || '-'} | $${p.purchasePriceUsd} | ${p.description.slice(0, 40)}`);
  }
}

main().finally(() => prisma.$disconnect());
