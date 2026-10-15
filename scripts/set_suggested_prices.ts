import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activeProds = await prisma.product.findMany({
    where: { isArchived: false }
  });

  for (const p of activeProds) {
    if (p.suggestedPricePen && p.suggestedPricePen > 0) continue;

    let price = 0;
    const title = p.description.toLowerCase();
    const model = (p.model || '').toUpperCase();

    if (title.includes('macbook pro 16') || model.includes('A2141')) {
      price = 1899;
    } else if (title.includes('15.4') || model.includes('A1990')) {
      price = 1699;
    } else if (title.includes('1068ng7') || model.includes('A2251')) {
      price = 1599;
    } else if (title.includes('macbook pro 13') || model.includes('A2159') || model.includes('A1989') || model.includes('A1706')) {
      price = title.includes('16gb') ? 1449 : 1299;
    } else if (title.includes('12.9') || model.includes('A1670')) {
      price = 1199;
    } else if (title.includes('ipad air 3') || model.includes('A2152') || model.includes('A2153')) {
      price = 879;
    } else if (title.includes('ipad 9') || title.includes('9th gen') || model.includes('A2602') || model.includes('A2603')) {
      price = 799;
    } else if (title.includes('ipad pro 10.5') || model.includes('A1701') || model.includes('A1709')) {
      price = title.includes('512gb') ? 949 : 849;
    } else if (title.includes('dell latitude') || title.includes('latitude 3330')) {
      price = 899;
    } else if (title.includes('charger') || title.includes('cargador')) {
      price = 169;
    } else {
      // Default formula
      price = Math.round((p.totalCostPen || (p.purchasePriceUsd * 3.4)) * 1.5);
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { suggestedPricePen: price, salePricePen: p.salePricePen || price }
    });
    console.log(`Updated [${p.orderNumber}] ${p.description.slice(0, 35)} -> S/ ${price}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
