import { db } from '../src/lib/db';

async function main() {
  const prods = await db.product.findMany({
    orderBy: { purchaseDate: 'asc' },
    select: {
      id: true,
      orderNumber: true,
      description: true,
      purchaseDate: true,
      createdAt: true,
      purchasePriceUsd: true,
      shippingCostUsd: true,
      exchangeRate: true,
      courier: true,
      trackingId: true,
      supplier: true,
      salePricePen: true,
      suggestedPricePen: true,
      advertisingCostUsd: true,
      extraCostsUsd: true,
      profitPen: true,
      shippingStatus: true,
      isArchived: true,
    }
  });

  const byMonth: Record<string, typeof prods> = {};
  for (const p of prods) {
    const d = p.purchaseDate || p.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(p);
  }

  console.log('Products in DB by Month:');
  for (const [m, items] of Object.entries(byMonth)) {
    console.log(`- ${m}: ${items.length} products`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
