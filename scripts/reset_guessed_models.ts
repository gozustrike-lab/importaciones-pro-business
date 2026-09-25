import { db } from '../src/lib/db';

async function resetGuessedModels() {
  const products = await db.product.findMany();
  console.log(`Auditing ${products.length} products...`);

  let resetCount = 0;
  for (const p of products) {
    const aMatch = p.description.match(/\b(A\d{4})\b/i);
    if (!aMatch) {
      // No explicit A#### in description -> Reset to empty string
      if (p.model !== '') {
        console.log(`Resetting model for [${p.orderNumber}]: "${p.model}" -> "" (Desc: ${p.description.substring(0, 50)}...)`);
        await db.product.update({
          where: { id: p.id },
          data: { model: '' }
        });
        resetCount++;
      }
    } else {
      const explicitA = aMatch[1].toUpperCase();
      if (p.model !== explicitA) {
        console.log(`Setting explicit model for [${p.orderNumber}]: "${p.model}" -> "${explicitA}"`);
        await db.product.update({
          where: { id: p.id },
          data: { model: explicitA }
        });
      }
    }
  }

  console.log(`\nDone. Reset ${resetCount} guessed models to empty string.`);
}

resetGuessedModels().catch(console.error);
