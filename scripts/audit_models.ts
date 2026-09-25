import { db } from '../src/lib/db';

async function auditModels() {
  const products = await db.product.findMany({
    orderBy: { purchaseDate: 'desc' }
  });

  console.log(`=== AUDITORIA DE MODELOS EN ${products.length} PRODUCTOS ===\n`);

  let explicitCount = 0;
  let guessedCount = 0;

  for (const p of products) {
    const aMatch = p.description.match(/\b(A\d{4})\b/i);
    const explicitA = aMatch ? aMatch[1].toUpperCase() : null;

    if (explicitA) {
      console.log(`[EXPLICITO] Order: ${p.orderNumber} | Current: "${p.model}" | Found in Title: "${explicitA}"`);
      explicitCount++;
    } else {
      console.log(`[NO EXPLICITO] Order: ${p.orderNumber} | Current: "${p.model}" | Title: ${p.description.substring(0, 60)}...`);
      guessedCount++;
    }
  }

  console.log(`\nResumen: ${explicitCount} con A#### explícito en el título | ${guessedCount} sin código explícito en el título.`);
}

auditModels().catch(console.error);
