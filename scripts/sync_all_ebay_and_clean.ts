import { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { getUserToken, getEbayConfig } from '../src/lib/ebay-account';
import { inferTechnicalModel } from '../src/lib/shipper-classification';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found');
    return;
  }

  // 1. Add Peggy's newest purchase 06-15262-15918 if not exists
  const existingNew = await prisma.product.findFirst({
    where: { orderNumber: '06-15262-15918' }
  });

  if (!existingNew) {
    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        purchaseDate: new Date('2026-10-05T06:04:05.000Z'),
        orderNumber: '06-15262-15918',
        supplier: 'rawko',
        courier: 'USPS',
        trackingId: '9434636208192288060290',
        shippingStatus: 'TRANSITO_USA',
        description: 'APPLE A2159 MacBook Pro 13 INCH, 2019 Laptop Intel I5-8257U 8GB 256GB',
        model: 'A2159 (MacBook Pro 13" 2019)',
        condition: 'Usado',
        purchasePriceUsd: 117.08,
        exchangeRate: 3.4,
        totalCostPen: Math.round(117.08 * 3.4 * 100) / 100,
        importerProfile: 'peggy',
        recipientName: 'Shiper Peggy Liliana Bonilla Orduña',
        ebayAccount: 'gozustrike@gmail.com',
        notes: 'ItemID: 327384873649'
      }
    });
    console.log('✅ Created product 06-15262-15918 for Peggy');
  }

  // 2. Update tracking numbers for in-transit orders
  await prisma.product.updateMany({
    where: { orderNumber: '04-15263-53974' },
    data: { trackingId: '9434650106151152072158', courier: 'USPS' }
  });
  await prisma.product.updateMany({
    where: { orderNumber: '03-15265-33955' },
    data: { trackingId: '9434650206217300194833', courier: 'USPS' }
  });

  // 3. Update order numbers for the 2 Dell / iPad orders bought today
  const dell = await prisma.product.findFirst({
    where: { orderNumber: '800340675226-10084619701505' }
  });
  if (dell) {
    await prisma.product.update({
      where: { id: dell.id },
      data: { orderNumber: '02-15-27101205' }
    });
    console.log('✅ Updated Dell order number to 02-15-27101205');
  }

  const ipad9 = await prisma.product.findFirst({
    where: { orderNumber: '137683221066-10088342250918' }
  });
  if (ipad9) {
    await prisma.product.update({
      where: { id: ipad9.id },
      data: { orderNumber: '02-15-27101592' }
    });
    console.log('✅ Updated iPad 9 order number to 02-15-27101592');
  }

  // 4. Archive the products that already left Miami in previous shipments (not in current warehouse screenshots)
  const previousShippedOrders = [
    '19-15168-53902', // in Shipment CC261002146091
    '19-15172-08085', // in Shipment CC261002990108
    '07-15226-51632', // in Shipment CC261002990108
    '23-15161-07326', // arrived 09/24, already departed
    '11-15187-84746', // arrived 09/23, already departed
    '05-15183-11042', // arrived 09/17, already departed
    '06-15188-79737-1', // arrived 09/21, already departed
  ];

  const archiveRes = await prisma.product.updateMany({
    where: {
      orderNumber: { in: previousShippedOrders },
      isArchived: false
    },
    data: {
      isArchived: true,
      archivedAt: new Date()
    }
  });
  console.log(`✅ Archived ${archiveRes.count} products from previous shipments.`);

  // 5. Summary of active products
  const remainingActive = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { purchaseDate: 'desc' }
  });
  console.log(`\nRemaining Active Products in DB: ${remainingActive.length}`);
  const inMiami = remainingActive.filter(p => p.shippingStatus === 'USA');
  const inTransit = remainingActive.filter(p => p.shippingStatus === 'TRANSITO_USA');
  console.log(`- En Almacén Miami: ${inMiami.length}`);
  console.log(`- En Tránsito a Miami: ${inTransit.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
