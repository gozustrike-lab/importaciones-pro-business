import { db } from '../src/lib/db';

async function run() {
  const prods = await db.product.findMany({
    select: {
      orderNumber: true,
      description: true,
      purchasePriceUsd: true,
      shippingCostUsd: true,
      shippingStatus: true,
      notes: true,
      totalCostPen: true,
      exchangeRate: true,
    }
  });
  console.log('Total prods in DB:', prods.length);
  const withShipping = prods.filter(p => (p.shippingCostUsd || 0) > 0);
  console.log('Products with shippingCostUsd > 0:', withShipping.length);
  for (const p of prods.slice(0, 8)) {
    console.log(`Order: ${p.orderNumber} | Price: $${p.purchasePriceUsd} | Ship: $${p.shippingCostUsd} | TotalPEN: S/${p.totalCostPen} | Notes: ${p.notes?.slice(0, 50)}`);
  }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
