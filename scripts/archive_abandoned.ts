import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ord = await prisma.product.findFirst({
    where: { orderNumber: '22-15154-01688' }
  });

  if (ord) {
    await prisma.product.update({
      where: { id: ord.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        shippingStatus: 'Extraviado',
        notes: `${ord.notes || ''} | [EXTRAVIADO EN ALMACÉN SHIPER MIAMI - DADO DE BAJA/ABANDONO]`.trim()
      }
    });
    console.log('✅ Orden 22-15154-01688 archivada y dada de baja exitosamente.');
  } else {
    console.log('Orden no encontrada');
  }

  const activeCount = await prisma.product.count({ where: { isArchived: false } });
  console.log(`Productos activos restantes: ${activeCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
