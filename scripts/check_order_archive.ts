import { db } from '../src/lib/db';

async function check() {
  const p = await db.product.findFirst({
    where: { orderNumber: { contains: '18-15136-37713' } }
  });
  console.log('Product 18-15136-37713:');
  console.log(JSON.stringify(p, null, 2));

  // Also check which products are in active vs archived in DB:
  const activeCount = await db.product.count({ where: { isArchived: false } });
  const archivedCount = await db.product.count({ where: { isArchived: true } });
  console.log(`\nDB Status: Active = ${activeCount}, Archived = ${archivedCount}`);
}

check().catch(console.error);
