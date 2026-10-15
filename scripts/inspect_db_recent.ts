import { PrismaClient } from '@prisma/client';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const prisma = new PrismaClient();

async function run() {
  const all = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- RECENT PRODUCTS IN DB (LAST 50) ---');
  for (const p of all.slice(0, 50)) {
    const isPeggy = (p.importerProfile || '').toLowerCase() === 'peggy' || (p.recipientName || '').toLowerCase().includes('peggy');
    console.log(`[${p.isArchived ? 'ARCHIVED' : 'ACTIVE'}] Ord: ${p.orderNumber} | ${p.courier} ${p.trackingId} | Status: ${p.shippingStatus} | ${isPeggy ? 'PEGGY' : 'FABIO'} | ${p.description.slice(0, 35)}`);
  }
}

run().finally(() => prisma.$disconnect());
