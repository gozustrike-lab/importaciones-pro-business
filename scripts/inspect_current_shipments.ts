import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log('Connecting using URL host:', dbUrl ? dbUrl.split('@')[1]?.split('/')[0] : 'NONE');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

async function main() {
  const count = await prisma.shipment.count();
  console.log('Total shipments in DB:', count);

  const shipments = await prisma.shipment.findMany({
    orderBy: { flightDate: 'desc' },
    take: 20,
    include: { products: true }
  });

  console.log('--- RECENT SHIPMENTS IN DB ---');
  for (const s of shipments) {
    console.log(
      `${s.code} | ${s.flightDayLabel} | ${s.importerProfile} | AWB: ${s.awbNumber || 'PENDIENTE'} | Status: ${s.status} | Products: ${s.products.length} | Items: ${s.totalItems} | FOB: $${s.totalFobUsd}`
    );
  }

  const productCount = await prisma.product.count();
  console.log('\nTotal products in DB:', productCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
