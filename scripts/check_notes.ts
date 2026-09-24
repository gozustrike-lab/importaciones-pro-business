import { db } from '../src/lib/db';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const prods = await db.product.findMany({
    select: { id: true, orderNumber: true, notes: true, description: true },
    take: 10,
  });
  console.log('Sample products:');
  for (const p of prods) {
    console.log(`Order: ${p.orderNumber} | Notes: "${p.notes}" | Desc: ${p.description.slice(0, 40)}`);
  }
}

run().catch(console.error).finally(() => process.exit(0));
