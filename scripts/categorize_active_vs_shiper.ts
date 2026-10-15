import { PrismaClient } from '@prisma/client';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const prisma = new PrismaClient();

const shiperTrks = [
  '383769867097','9434636208192282284302','383810188373','1ZC9529D0322121977',
  '1Z14V5340334662831','1Z14V5340324609006','9400150105794102233309','9400150105495103323777',
  '9400150206217928132260','1ZC9529D0324359771','383833691742','1Z78Y5W70393237310',
  '9436208106245579767610','1Z0R2B760324495226','9434608106244558949658','383847078355',
  '1Z14V5340320924511','383918781243','9434608106244603884132','1ZC9529D0305930518',
  '9236290419992000051128'
];

async function run() {
  const activeProducts = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'desc' }
  });

  console.log('=== DESGLOSE DE PRODUCTOS ACTIVOS (40) ===');
  console.log('1. EN ALMACÉN SHIPER MIAMI (CONFIRMADOS EN PORTAL DE SHIPER - 21 PAQUETES):');
  for (const p of activeProducts) {
    const isMatch = shiperTrks.some(st => p.trackingId && (p.trackingId.includes(st) || st.includes(p.trackingId)));
    if (isMatch) {
      console.log(`  [SHIPER OK] Ord: ${p.orderNumber} | ${p.courier} ${p.trackingId} | ${p.importerProfile.toUpperCase()} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
    }
  }

  console.log('\n2. PAQUETE NO ENCONTRADO EN SHIPER (ALERTA CRÍTICA):');
  const target = activeProducts.find(p => p.trackingId.includes('383772352970'));
  if (target) {
    console.log(`  [ALERTA FEDEX] Ord: ${target.orderNumber} | FEDEX ${target.trackingId} | Entregado en eBay: 25 Sep | PEGGY | $${target.purchasePriceUsd} | ${target.description}`);
  }

  console.log('\n3. PAQUETES QUE FIGURAN "USA" EN BD PERO NO ESTÁN EN EL PORTAL DE SHIPER DE HOY:');
  for (const p of activeProducts) {
    const isMatch = shiperTrks.some(st => p.trackingId && (p.trackingId.includes(st) || st.includes(p.trackingId)));
    if (!isMatch && p.shippingStatus === 'USA' && !p.trackingId.includes('383772352970')) {
      console.log(`  [STATUS USA PERO NO EN SHIPER] Ord: ${p.orderNumber} | ${p.courier} ${p.trackingId} | Arr: ${p.actualArrival?.toISOString().slice(0,10)} | ${p.importerProfile.toUpperCase()} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
    }
  }

  console.log('\n4. PAQUETES EN TRÁNSITO RUMBO A MIAMI (COMPRAS RECIENTES):');
  for (const p of activeProducts) {
    if (p.shippingStatus === 'TRANSITO_USA') {
      console.log(`  [TRÁNSITO USA] Ord: ${p.orderNumber} | ${p.courier} ${p.trackingId || 'PENDIENTE TRACKING'} | ${p.importerProfile.toUpperCase()} | $${p.purchasePriceUsd} | ${p.description.slice(0, 45)}`);
    }
  }
}

run().finally(() => prisma.$disconnect());
