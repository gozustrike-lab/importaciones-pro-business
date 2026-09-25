import { db } from '../src/lib/db';

async function main() {
  const allActive = await db.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'asc' }
  });
  console.log(`Total activos en DB: ${allActive.length}`);
  const oldest7 = allActive.slice(0, 7);
  console.log('\n--- LOS 7 MÁS ANTIGUOS (AGOSTO Y PRINCIPIOS DE SETIEMBRE ENTREGADOS) ---');
  oldest7.forEach((p, i) => {
    console.log(`${i+1}. [${p.orderNumber}] ${p.purchaseDate.toISOString().slice(0, 10)} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
  });

  const remaining24 = allActive.slice(7);
  console.log(`\n--- LOS 24 RESTANTES ACTIVOS (DE SETIEMBRE) ---`);
  remaining24.forEach((p, i) => {
    console.log(`${i+1}. [${p.orderNumber}] ${p.purchaseDate.toISOString().slice(0, 10)} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
