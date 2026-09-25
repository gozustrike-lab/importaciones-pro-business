import { db } from '../src/lib/db';

async function archiveShippedOrder() {
  const updated = await db.product.updateMany({
    where: { orderNumber: { contains: '18-15136-37713' } },
    data: { isArchived: true }
  });

  console.log(`Archived ${updated.count} items for order 18-15136-37713`);
}

archiveShippedOrder().catch(console.error);
