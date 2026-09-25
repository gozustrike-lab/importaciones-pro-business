import { db } from '../src/lib/db';

async function main() {
  const all = await db.product.findMany({ orderBy: { purchaseDate: 'desc' } });
  console.log('Total en BD:', all.length);
  const sep = all.filter(p => p.purchaseDate.toISOString().startsWith('2026-09'));
  const aug = all.filter(p => p.purchaseDate.toISOString().startsWith('2026-08'));
  console.log('Septiembre 2026:', sep.length, '(Activos:', sep.filter(p => !p.isArchived).length, ', Archivados:', sep.filter(p => p.isArchived).length, ')');
  console.log('Agosto 2026:', aug.length, '(Activos:', aug.filter(p => !p.isArchived).length, ', Archivados:', aug.filter(p => p.isArchived).length, ')');

  console.log('\n--- ACTIVOS EN SEPTIEMBRE (' + sep.filter(p => !p.isArchived).length + ') ---');
  sep.filter(p => !p.isArchived).forEach((p, i) => {
    console.log((i + 1) + '. [SEP] Ord: ' + p.orderNumber + ' | ' + p.purchaseDate.toISOString().slice(0, 10) + ' | ' + p.importerProfile + ' | $' + p.purchasePriceUsd + ' | ' + p.description.slice(0, 45));
  });

  console.log('\n--- ACTIVOS EN AGOSTO (' + aug.filter(p => !p.isArchived).length + ') ---');
  aug.filter(p => !p.isArchived).forEach((p, i) => {
    console.log((i + 1) + '. [AGO] Ord: ' + p.orderNumber + ' | ' + p.purchaseDate.toISOString().slice(0, 10) + ' | ' + p.importerProfile + ' | $' + p.purchasePriceUsd + ' | ' + p.description.slice(0, 45));
  });

  console.log('\n--- ARCHIVADOS (' + all.filter(p => p.isArchived).length + ') ---');
  all.filter(p => p.isArchived).forEach((p, i) => {
    console.log((i + 1) + '. [ARCH] Ord: ' + p.orderNumber + ' | ' + p.purchaseDate.toISOString().slice(0, 10) + ' | ' + p.importerProfile + ' | $' + p.purchasePriceUsd + ' | ' + p.description.slice(0, 45));
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
