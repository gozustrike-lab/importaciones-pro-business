import { db } from '../src/lib/db';

async function main() {
  const totalProducts = await db.product.count();
  const withTracking = await db.product.count({
    where: {
      trackingId: { not: '' }
    }
  });
  const trackingUpdateCount = await db.trackingUpdate.count();
  
  const statusCounts = await db.product.groupBy({
    by: ['shippingStatus'],
    _count: { id: true }
  });

  const courierCounts = await db.product.groupBy({
    by: ['courier'],
    _count: { id: true }
  });

  const sampleProducts = await db.product.findMany({
    where: { trackingId: { not: '' } },
    take: 10,
    select: {
      id: true,
      description: true,
      trackingId: true,
      shipperTracking: true,
      courier: true,
      shippingStatus: true,
      shipperConfirmed: true,
      purchaseDate: true,
      estimatedArrival: true,
      actualArrival: true,
    }
  });

  console.log(JSON.stringify({
    totalProducts,
    withTracking,
    trackingUpdateCount,
    statusCounts,
    courierCounts,
    sampleProducts
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
