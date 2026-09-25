import { db } from '../src/lib/db';

async function listAll() {
  const products = await db.product.findMany({
    select: {
      id: true,
      description: true,
      model: true,
      orderNumber: true,
      trackingId: true,
      courier: true,
      quantity: true,
      isArchived: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total products: ${products.length}`);
  products.forEach((p, idx) => {
    const aMatch = p.description.match(/\b(A\d{4})\b/i);
    console.log(
      `#${idx + 1} [${p.orderNumber}] ${p.isArchived ? '(Archived)' : '(Active)'}\n` +
      `   Desc: ${p.description.substring(0, 80)}\n` +
      `   Current Model: "${p.model}" | Found A-code: ${aMatch ? aMatch[1].toUpperCase() : 'None'}`
    );
  });
}

listAll().catch(console.error);
