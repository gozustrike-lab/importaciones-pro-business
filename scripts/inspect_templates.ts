import { db } from '../src/lib/db';

async function check() {
  const products = await db.product.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      description: true,
      model: true,
      orderNumber: true,
      category: true,
    }
  });

  for (const p of products) {
    console.log(`- [${p.orderNumber}] model="${p.model}": ${p.description.substring(0, 60)}...`);
  }
}

check().catch(console.error);
