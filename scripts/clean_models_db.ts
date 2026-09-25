import { db } from '../src/lib/db';

function detectCleanModel(desc: string, currentModel: string | null): string {
  // 1. Direct A-number in description
  const aMatch = desc.match(/\b(A\d{4})\b/i);
  if (aMatch) return aMatch[1].toUpperCase();

  // 2. Direct A-number in currentModel
  if (currentModel) {
    const aFromCurrent = currentModel.match(/\b(A\d{4})\b/i);
    if (aFromCurrent) return aFromCurrent[1].toUpperCase();
  }

  const d = desc.toLowerCase();

  // 3. Known Apple mappings
  if (d.includes('ipad pro 10.5') || d.includes('10.5in') || (d.includes('10.5') && d.includes('ipad pro'))) {
    if (d.includes('cellular') || d.includes('4g') || d.includes('lte')) return 'A1709';
    return 'A1701';
  }

  if (d.includes('ipad 7') || d.includes('7ma') || d.includes('7th gen')) {
    if (d.includes('cellular') || d.includes('unlocked') || d.includes('4g')) return 'A2200';
    return 'A2197';
  }

  if (d.includes('ipad 9') || d.includes('9na') || d.includes('9th gen')) {
    if (d.includes('4g') || d.includes('cellular') || d.includes('lte')) return 'A2603';
    return 'A2602';
  }

  if (d.includes('ipad air 3') || d.includes('air 3rd') || d.includes('air (3rd')) {
    if (d.includes('cellular') || d.includes('unlocked') || d.includes('4g')) return 'A2153';
    return 'A2152';
  }

  if (d.includes('ipad pro 12.9') && (d.includes('2nd gen') || d.includes('2017'))) {
    if (d.includes('lte') || d.includes('cellular')) return 'A1671';
    return 'A1670';
  }

  if (d.includes('macbook pro 16') && (d.includes('2019') || d.includes('16,1') || d.includes('i7-9750h'))) {
    return 'A2141';
  }

  if (d.includes('macbook pro 13') && (d.includes('2019') || d.includes('i5-8279u') || d.includes('i7-8559u') || d.includes('i5-8259u'))) {
    return 'A2159';
  }

  if (d.includes('macbook pro 13') && d.includes('i7-1068ng7')) {
    return 'A2251';
  }

  if (d.includes('iphone se') && (d.includes('3rd') || d.includes('a13') || d.includes('2022'))) {
    return 'A2595';
  }

  return '';
}

async function run() {
  const products = await db.product.findMany();
  console.log(`Checking ${products.length} products in DB...`);

  let updatedCount = 0;
  for (const p of products) {
    const cleanModel = detectCleanModel(p.description, p.model);
    if (cleanModel && cleanModel !== p.model) {
      console.log(`Updating [${p.orderNumber}]: "${p.model}" -> "${cleanModel}" (${p.description.substring(0, 50)}...)`);
      await db.product.update({
        where: { id: p.id },
        data: { model: cleanModel }
      });
      updatedCount++;
    }
  }

  console.log(`\nUpdated ${updatedCount} products with clean A#### models.`);
}

run().catch(console.error);
