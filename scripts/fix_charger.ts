import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.product.updateMany({
    where: { orderNumber: '03-15241-27810' },
    data: { suggestedPricePen: 169, salePricePen: 169 }
  });
  console.log('Fixed charger price to S/ 169');
}
main().catch(console.error).finally(() => prisma.$disconnect());
