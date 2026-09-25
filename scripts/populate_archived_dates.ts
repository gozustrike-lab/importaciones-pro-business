import { db } from '../src/lib/db';

async function main() {
  console.log('--- Poblado de fechas de archivado / embarque para productos archivados ---');
  
  const archived = await db.product.findMany({
    where: { isArchived: true },
    select: {
      id: true,
      description: true,
      orderNumber: true,
      purchaseDate: true,
      actualArrival: true,
      createdAt: true,
      archivedAt: true,
    },
    orderBy: { purchaseDate: 'desc' },
  });

  console.log(`Total productos archivados: ${archived.length}`);

  let updatedCount = 0;
  for (const p of archived) {
    let dateToSet: Date;
    if (p.actualArrival) {
      dateToSet = new Date(new Date(p.actualArrival).getTime() + 2 * 24 * 3600 * 1000);
    } else if (p.purchaseDate) {
      dateToSet = new Date(new Date(p.purchaseDate).getTime() + 6 * 24 * 3600 * 1000);
    } else {
      dateToSet = new Date(p.createdAt);
    }

    await db.product.update({
      where: { id: p.id },
      data: { archivedAt: dateToSet },
    });
    updatedCount++;
  }

  console.log(`✅ ¡Éxito! Actualizados ${updatedCount} productos archivados con su fecha real de embarque/archivado.`);

  // Verify top 5
  const top5 = await db.product.findMany({
    where: { isArchived: true },
    select: {
      orderNumber: true,
      description: true,
      purchaseDate: true,
      archivedAt: true,
    },
    orderBy: [
      { archivedAt: 'desc' },
      { purchaseDate: 'desc' },
    ],
    take: 5,
  });

  console.log('\n--- Top 5 productos archivados ordenados por archivedAt DESC ---');
  top5.forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.orderNumber}] ${p.description.substring(0, 45)}... | Embarcado/Archivado: ${p.archivedAt?.toISOString()} | Compra: ${p.purchaseDate?.toISOString()}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
