import { db } from '../src/lib/db';

async function main() {
  const prods = await db.product.findMany({
    where: { isArchived: true },
    select: {
      id: true,
      description: true,
      orderNumber: true,
      purchaseDate: true,
      actualArrival: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  console.log('--- Top 10 by updatedAt DESC ---');
  prods.forEach((p, i) => {
    console.log(`${i + 1}. [${p.orderNumber}] ${p.description.substring(0, 40)}... | Purchase: ${p.purchaseDate?.toISOString()} | Updated: ${p.updatedAt?.toISOString()} | Created: ${p.createdAt?.toISOString()}`);
  });

  const prodsByPurchase = await db.product.findMany({
    where: { isArchived: true },
    select: {
      id: true,
      description: true,
      orderNumber: true,
      purchaseDate: true,
      actualArrival: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { purchaseDate: 'desc' },
    take: 10,
  });

  console.log('\n--- Top 10 by purchaseDate DESC ---');
  prodsByPurchase.forEach((p, i) => {
    console.log(`${i + 1}. [${p.orderNumber}] ${p.description.substring(0, 40)}... | Purchase: ${p.purchaseDate?.toISOString()} | Updated: ${p.updatedAt?.toISOString()} | Created: ${p.createdAt?.toISOString()}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
