import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ orderBy: { purchaseDate: 'desc' } });
  const sales = await prisma.sale.findMany({ include: { product: true } });

  console.log('=== VERIFICACIÓN END-TO-END DE SALDOS ===');
  console.log(`Total productos en BD: ${products.length}`);
  console.log(`Total ventas en BD: ${sales.length}`);

  const byMonth: Record<string, { fabio: any[]; peggy: any[] }> = {};

  for (const p of products) {
    const d = p.purchaseDate || p.createdAt;
    const m = d.toISOString().substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { fabio: [], peggy: [] };
    const isPeggy =
      p.importerProfile === 'peggy' ||
      (p.recipientName && p.recipientName.toLowerCase().includes('peggy')) ||
      (p.recipientName && p.recipientName.toLowerCase().includes('liliana'));

    if (isPeggy) {
      byMonth[m].peggy.push(p);
    } else {
      byMonth[m].fabio.push(p);
    }
  }

  for (const [m, data] of Object.entries(byMonth)) {
    const fabioUsd = data.fabio.reduce((s, p) => s + p.purchasePriceUsd, 0);
    const fabioPen = data.fabio.reduce((s, p) => s + (p.totalCostPen || p.purchasePriceUsd * 3.4), 0);
    const peggyUsd = data.peggy.reduce((s, p) => s + p.purchasePriceUsd, 0);
    const peggyPen = data.peggy.reduce((s, p) => s + (p.totalCostPen || p.purchasePriceUsd * 3.4), 0);

    console.log(`\nMes: ${m}`);
    console.log(`  👨 FABIO CÉSAR (RUC 10762026835):`);
    console.log(`     Items: ${data.fabio.length}`);
    console.log(`     Total USD: $${fabioUsd.toFixed(2)}`);
    console.log(`     Total PEN (T.C. 3.40): S/ ${fabioPen.toFixed(2)}`);
    console.log(`     Límite RUS: S/ 8,000.00 | Disponible: S/ ${(8000 - fabioPen).toFixed(2)} (${((fabioPen / 8000) * 100).toFixed(1)}% consumido)`);

    console.log(`  👩 PEGGY LILIANA (RUC 10091870911):`);
    console.log(`     Items: ${data.peggy.length}`);
    console.log(`     Total USD: $${peggyUsd.toFixed(2)}`);
    console.log(`     Total PEN (T.C. 3.40): S/ ${peggyPen.toFixed(2)}`);
    console.log(`     Límite RUS: S/ 8,000.00 | Disponible: S/ ${(8000 - peggyPen).toFixed(2)} (${((peggyPen / 8000) * 100).toFixed(1)}% consumido)`);
  }

  console.log('\n=== LISTA DETALLADA DE PRODUCTOS ===');
  for (const p of products) {
    const isPeggy =
      p.importerProfile === 'peggy' ||
      (p.recipientName && p.recipientName.toLowerCase().includes('peggy'));
    console.log(
      `[${p.orderNumber}] ${isPeggy ? 'PEGGY' : 'FABIO'} | $${p.purchasePriceUsd} USD -> S/ ${p.totalCostPen} PEN | Recipient: "${p.recipientName}" | Status: ${p.shippingStatus} | ${p.description.substring(0, 40)}...`
    );
  }

  await prisma.$disconnect();
}

main();
