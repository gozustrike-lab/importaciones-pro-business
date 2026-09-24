import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Limpiando datos de prueba / demo falsos...\n');

  // 1. Eliminar ventas ficticias
  const deletedSales = await db.sale.deleteMany({});
  console.log(`✅ Eliminadas ${deletedSales.count} ventas ficticias.`);

  // 2. Eliminar clientes de prueba
  const deletedClients = await db.client.deleteMany({});
  console.log(`✅ Eliminados ${deletedClients.count} clientes de prueba (Carlos Mendoza, etc.).`);

  // 3. Eliminar productos falsos, manteniendo SOLO los reales
  const realTrackings = [
    '1Z0R2B760325209042', // iPad Pro 10.5 Fabio
    '1Z0R2B760339138058', // iPad Pro 10.5 Fabio
    '9400108205497721934380', // iPad 7ma Gen Peggy
  ];

  const deletedProducts = await db.product.deleteMany({
    where: {
      trackingId: { notIn: realTrackings },
    },
  });
  console.log(`✅ Eliminados ${deletedProducts.count} productos de prueba demo.`);

  // Asegurar que el iPad de Peggy esté en la base de datos si aún no estaba
  const user = await db.user.findFirst({ where: { email: 'gozustrike@gmail.com' } });
  if (user && user.tenantId) {
    const peggyItemExists = await db.product.findFirst({ where: { trackingId: '9400108205497721934380' } });
    if (!peggyItemExists) {
      await db.product.create({
        data: {
          purchaseDate: new Date('2026-09-10T15:30:00Z'),
          orderNumber: '23-15114-36516',
          supplier: 'EBAY',
          courier: 'USPS',
          trackingId: '9400108205497721934380',
          shippingStatus: 'USA',
          description: 'Apple iPad 7ma Generación 10.2 pulgadas 32GB Wi-Fi Space Gray',
          category: 'Tabletas',
          model: 'A2197 (iPad 7th Gen)',
          color: 'Gris Espacial',
          capacity: '32 GB',
          grade: 'B',
          condition: 'Usado',
          quantity: 1,
          purchasePriceUsd: 110.0,
          shippingCostUsd: 0.0,
          exchangeRate: 3.40,
          totalCostPen: 374.0,
          salePricePen: 750.0,
          suggestedPricePen: 799.0,
          tenantId: user.tenantId,
          notes: 'Compra real eBay - Casillero Shipper Doral FL (Peggy Liliana Bonilla)',
        },
      });
      console.log('✅ Creado producto real de Peggy en DB.');
    }
  }

  // 4. Verificar qué productos quedaron en la base de datos
  const remaining = await db.product.findMany({ select: { description: true, trackingId: true, purchasePriceUsd: true } });
  console.log('\n📦 Productos reales conservados en base de datos:');
  remaining.forEach((p, idx) => {
    console.log(`   ${idx + 1}. [${p.trackingId}] ${p.description} ($${p.purchasePriceUsd} USD)`);
  });

  console.log('\n🎉 Base de datos 100% limpia y concentrada en tu negocio real.');
}

cleanDatabase()
  .catch(console.error)
  .finally(() => db.$disconnect());
