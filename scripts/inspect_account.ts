import { db } from '../src/lib/db';

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function test() {
  const prods = await db.product.findMany({
    select: { id: true, orderNumber: true, description: true, model: true, condition: true, quantity: true, isArchived: true, purchasePriceUsd: true },
    orderBy: { purchaseDate: 'asc' }
  });
  console.log(`Total productos: ${prods.length}`);
  for (const p of prods) {
    console.log(`[${p.orderNumber}] Cant: ${p.quantity} | Mod: ${p.model || 'SIN_MOD'} | Cond: ${p.condition} | Arch: ${p.isArchived} | Desc: ${p.description.slice(0, 35)}`);
  }
}

test().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
