import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activeProds = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: [{ importerProfile: 'asc' }, { shippingStatus: 'asc' }, { purchaseDate: 'asc' }]
  });

  console.log(`=== REPORTE TOTAL ACTIVOS (${activeProds.length}) ===\n`);
  for (const p of activeProds) {
    console.log(`[${p.importerProfile.toUpperCase()}] [${p.shippingStatus}] Ord: ${p.orderNumber} | Trk: ${p.trackingId || 'PENDIENTE'} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
