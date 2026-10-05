import { db } from '../src/lib/db';

async function main() {
  const all = await db.product.findMany({
    orderBy: { purchaseDate: 'asc' }
  });

  const fabio = all.filter(p => !((p.importerProfile || '').toLowerCase().includes('peggy') || (p.importerProfile || '').toLowerCase().includes('liliana') || (p.recipientName || '').toLowerCase().includes('peggy') || (p.recipientName || '').toLowerCase().includes('liliana')));
  const liliana = all.filter(p => ((p.importerProfile || '').toLowerCase().includes('peggy') || (p.importerProfile || '').toLowerCase().includes('liliana') || (p.recipientName || '').toLowerCase().includes('peggy') || (p.recipientName || '').toLowerCase().includes('liliana')));

  console.log(`TOTAL DB PRODUCTS: ${all.length}`);
  console.log(`FABIO: ${fabio.length} (2025: ${fabio.filter(p => (p.purchaseDate || p.createdAt).getFullYear() === 2025).length}, 2026: ${fabio.filter(p => (p.purchaseDate || p.createdAt).getFullYear() === 2026).length})`);
  console.log(`LILIANA: ${liliana.length} (2025: ${liliana.filter(p => (p.purchaseDate || p.createdAt).getFullYear() === 2025).length}, 2026: ${liliana.filter(p => (p.purchaseDate || p.createdAt).getFullYear() === 2026).length})`);

  console.log('\n--- FABIO BY MONTH & YEAR ---');
  const fByYM: Record<string, number> = {};
  fabio.forEach(p => {
    const d = p.purchaseDate || p.createdAt;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fByYM[ym] = (fByYM[ym] || 0) + 1;
  });
  console.log(fByYM);

  console.log('\n--- LILIANA BY MONTH & YEAR ---');
  const lByYM: Record<string, number> = {};
  liliana.forEach(p => {
    const d = p.purchaseDate || p.createdAt;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lByYM[ym] = (lByYM[ym] || 0) + 1;
  });
  console.log(lByYM);
}

main().catch(console.error).finally(() => process.exit(0));
