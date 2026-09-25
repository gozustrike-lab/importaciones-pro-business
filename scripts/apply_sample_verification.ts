import { db } from '../src/lib/db';

async function main() {
  const text = `383588104255 si figura en sistema
9434608106244558949658 no figura en sistema
(420)331722139(94)36208106245579767610 si figura en sistema, consdierar tal cual se lo paso
383730102539 si figura en sistema
9400108106244561752717 si figura en sistema
1ZY839R70396796677 si figura en sistema
(420)33172(94)34636208192282284302 si figura en sistema, considerar tal cual se lo paso
383769867097 si figura en sistema
1ZE7W9520391498799 si figura en sistema
1Z0R2B760334443807 si figura en sistema
1Z0R2B760324495226 si figura en sistema
1Z0R2B760333197611 si figura en sistema`;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let updated = 0;
  for (const line of lines) {
    const isNo = /no\s+figura/i.test(line);
    const isSi = /si\s+figura|s[ií]\s+figura/i.test(line);
    const confirmed = isSi && !isNo;

    let baseTracking = '';
    let shipperTracking = '';

    const gs1Match = line.match(/\(420\)[0-9]+\(94\)([0-9]+)/i);
    const fullGs1Match = line.match(/(\(420\)[0-9]+\(94\)[0-9]+)/i);

    if (gs1Match && fullGs1Match) {
      baseTracking = gs1Match[1];
      shipperTracking = fullGs1Match[1];
    } else {
      const m = line.match(/\b(1Z[A-Z0-9]{16}|\d{20,24}|\d{12})\b/i);
      if (m) baseTracking = m[1];
    }

    if (!baseTracking) continue;

    const product = await db.product.findFirst({
      where: {
        OR: [
          { trackingId: { contains: baseTracking } },
          { shipperTracking: { contains: baseTracking } }
        ]
      }
    });

    if (product) {
      const data: any = {
        shipperConfirmed: confirmed
      };
      if (confirmed && product.shippingStatus === 'TRANSITO_USA') {
        data.shippingStatus = 'USA';
      }
      if (shipperTracking) {
        data.shipperTracking = shipperTracking;
      }
      await db.product.update({
        where: { id: product.id },
        data
      });
      console.log(`✓ Actualizado: ${product.orderNumber} | Confirmed: ${confirmed} | ShiperTracking: ${shipperTracking || product.trackingId}`);
      updated++;
    } else {
      console.log(`⚠️ No encontrado en BD: ${baseTracking}`);
    }
  }

  console.log(`\nListo: ${updated} productos actualizados con la verificación de Shiper.`);
}

main().catch(console.error).finally(() => process.exit(0));
