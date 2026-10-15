import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shipments = await prisma.shipment.findMany({
    include: { products: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total shipments in DB:', shipments.length);
  for (const s of shipments) {
    console.log(`Shipment: ${s.code} | Status: ${s.status} | Date: ${s.flightDate.toISOString().slice(0, 10)} | Profile: ${s.importerProfile} | Consignee: ${s.consigneeName} | Prods: ${s.products.length} | Items: ${s.totalItems} | FOB: $${s.totalFobUsd}`);
    for (const p of s.products) {
      console.log(`   -> [${p.orderNumber}] ${p.description.slice(0, 40)} | $${p.purchasePriceUsd}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
