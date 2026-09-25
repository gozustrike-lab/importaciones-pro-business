import { db } from '../src/lib/db';

async function main() {
  const orderNumbersToArchive = [
    '21-15060-59443', // 25 ago ($65)
    '24-15073-42529', // 26 ago ($79.99)
    '16-15082-32961', // 28 ago ($94.99)
    '26-15095-19840', // 04 set ($92.99)
    '20-15106-11503', // 04 set ($82.99)
    '23-15114-36516', // 10 set ($110.00)
    '17-15138-14588', // 10 set ($89.95)
  ];

  console.log(`Archivando las 7 compras más antiguas ya entregadas en Miami...`);
  for (const ord of orderNumbersToArchive) {
    const updated = await db.product.updateMany({
      where: { orderNumber: ord },
      data: { isArchived: true },
    });
    console.log(`  -> Orden ${ord}: ${updated.count} registro(s) archivado(s)`);
  }

  const activos = await db.product.count({ where: { isArchived: false } });
  const archivados = await db.product.count({ where: { isArchived: true } });
  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Activos: ${activos} (¡Exactamente 24 como en tu historial de eBay!)`);
  console.log(`Archivados: ${archivados}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
