import { db } from '../src/lib/db';

async function listCurrentActive() {
  const active = await db.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'asc' },
    select: {
      orderNumber: true,
      purchaseDate: true,
      actualArrival: true,
      description: true,
      courier: true,
      trackingId: true,
      shippingStatus: true,
    }
  });

  console.log(`Active count now: ${active.length}`);
  active.forEach((p, i) => {
    console.log(
      `#${i + 1} | Order: ${p.orderNumber} | Bought: ${p.purchaseDate?.toISOString().slice(0, 10)} | Delivered Miami: ${p.actualArrival ? p.actualArrival.toISOString().slice(0, 10) : 'Pending'}\n` +
      `   Desc: ${p.description.substring(0, 75)}\n`
    );
  });
}

listCurrentActive().catch(console.error);
