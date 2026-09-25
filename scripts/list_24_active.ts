import { db } from '../src/lib/db';

async function listActive() {
  const activeProducts = await db.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      purchaseDate: true,
      description: true,
      courier: true,
      trackingId: true,
      actualArrival: true,
      purchasePriceUsd: true,
      model: true,
    }
  });

  console.log(`=== 24 PRODUCTOS ACTIVOS ACTUALES ===`);
  activeProducts.forEach((p, i) => {
    console.log(
      `#${i + 1} | Order: ${p.orderNumber} | Date: ${p.purchaseDate ? p.purchaseDate.toISOString().slice(0, 10) : 'N/A'} | Price: $${p.purchasePriceUsd}\n` +
      `   Desc: ${p.description.substring(0, 70)}\n` +
      `   Tracking: ${p.courier} ${p.trackingId || 'N/A'}\n`
    );
  });
}

listActive().catch(console.error);
