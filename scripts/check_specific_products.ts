import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orderNums = [
    '23-15161-07326',
    '11-15187-84746',
    '05-15183-11042',
    '06-15188-79737-1',
    '06-15188-79737',
    '19-15168-53902',
    '19-15172-08085',
    '07-15226-51632'
  ];

  const products = await prisma.product.findMany({
    where: {
      orderNumber: { in: orderNums }
    },
    include: { shipment: true }
  });

  for (const p of products) {
    console.log(`Ord: ${p.orderNumber} | isArchived: ${p.isArchived} | Status: ${p.shippingStatus} | Profile: ${p.importerProfile} | Shipment: ${p.shipment ? p.shipment.code : 'NONE'} | Title: ${p.description.slice(0, 35)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
