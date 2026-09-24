import { db } from '../src/lib/db';

async function main() {
  console.log('=== ACTUALIZACIÓN DE CONTABILIDAD Y ARCHIVADO ===');

  // 1. Marcar como archivados los productos del embarque EMB-20260914-FABIO-01 (ya embarcados a Perú)
  const shipment = await db.shipment.findFirst({
    where: { code: 'EMB-20260914-FABIO-01' },
    include: { products: true },
  });

  if (shipment) {
    console.log(`Encontrado embarque ${shipment.code} con ${shipment.products.length} productos.`);
    for (const p of shipment.products) {
      await db.product.update({
        where: { id: p.id },
        data: { isArchived: true },
      });
      console.log(`  -> Archivado producto ${p.orderNumber} (${p.description.slice(0, 30)})`);
    }
  }

  // 2. Corregir orden 06-15208-16757: Item $141 + Envío $15 = Order Total $156 USD (según captura real de eBay)
  const order06 = await db.product.findFirst({
    where: { orderNumber: '06-15208-16757' },
  });
  if (order06) {
    const exchangeRate = 3.40;
    const totalUsd = 156.00;
    const totalPen = Math.round(totalUsd * exchangeRate * 100) / 100; // S/ 530.40
    await db.product.update({
      where: { id: order06.id },
      data: {
        purchasePriceUsd: 141.00,
        shippingCostUsd: 15.00,
        totalCostPen: totalPen,
      },
    });
    console.log(`Corregido orden 06-15208-16757: Ítem $141 + Envío $15 = Total $156 USD (S/ ${totalPen} PEN)`);
  }

  // 3. Corregir item con ID de transacción 137571538192-10084060041001 -> pertenece a 26-15141-31231
  const lineItemProd = await db.product.findFirst({
    where: { orderNumber: '137571538192-10084060041001' },
  });
  if (lineItemProd) {
    await db.product.update({
      where: { id: lineItemProd.id },
      data: {
        orderNumber: '26-15141-31231-2',
        recipientName: 'Shiper Fabio Cesar Herrera Bonilla',
        importerProfile: 'fabio',
        isArchived: true, // Aparece en la captura de eBay "Hidden Items" (archivados)
      },
    });
    console.log(`Corregido orderNumber 137571538192-10084060041001 -> 26-15141-31231-2 (Fabio, Archivado)`);
  }

  // 4. Marcar 26-15141-31231-1 como archivado (aparece en la captura de eBay "Hidden Items")
  const order26 = await db.product.findFirst({
    where: { orderNumber: '26-15141-31231-1' },
  });
  if (order26) {
    await db.product.update({
      where: { id: order26.id },
      data: { isArchived: true },
    });
    console.log(`Archivado 26-15141-31231-1 (en Hidden Items de eBay)`);
  }

  console.log('\n=== VERIFICACIÓN FINAL ===');
  const allProducts = await db.product.findMany();
  const activos = allProducts.filter(p => !p.isArchived);
  const archivados = allProducts.filter(p => p.isArchived);
  console.log(`Total productos: ${allProducts.length}`);
  console.log(`Productos activos: ${activos.length}`);
  console.log(`Productos archivados (Show hidden / embarcados): ${archivados.length}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
