import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activeProds = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'desc' }
  });

  console.log(`Total active products: ${activeProds.length}`);
  const modelsMap = new Map<string, any[]>();
  for (const p of activeProds) {
    const key = p.model || p.description.slice(0, 30);
    if (!modelsMap.has(key)) modelsMap.set(key, []);
    modelsMap.get(key)!.push(p);
  }

  for (const [m, prods] of modelsMap.entries()) {
    console.log(`\nModel: "${m}" (${prods.length} unidades)`);
    for (const p of prods) {
      console.log(`  - Ord: ${p.orderNumber} | Cost: $${p.purchasePriceUsd} | Cost PEN: S/${p.totalCostPen} | Sug: S/${p.suggestedPricePen || p.salePricePen} | Status: ${p.shippingStatus} | ${p.description.slice(0, 50)}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
