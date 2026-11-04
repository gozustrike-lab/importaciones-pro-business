import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

const chatPath = 'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\WHATSAPP CHAT\\SHIPERHISTORIAL 04 11\\chat.txt';
const raw = fs.readFileSync(chatPath, 'utf8');

async function main() {
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true,
      orderNumber: true,
      trackingId: true,
      courier: true,
      description: true,
      shippingStatus: true,
      shipperTracking: true,
      shipperConfirmed: true,
      shipmentId: true,
      purchasePriceUsd: true,
      purchaseDate: true
    }
  });

  console.log(`Loaded ${dbProducts.length} products from database.`);

  // Extract all tracking candidates from chat (USPS 20-30 digits, UPS 1Z..., FedEx 12 digits)
  const trackingPattern = /\b(1Z[0-9A-Z]{16}|9[2-5]\d{20,24}|38\d{10}|87\d{10})\b/gi;
  const matches = raw.matchAll(trackingPattern);
  const foundTrackings = new Map();

  for (const m of matches) {
    const trk = m[1].toUpperCase();
    foundTrackings.set(trk, (foundTrackings.get(trk) || 0) + 1);
  }

  console.log(`Found ${foundTrackings.size} unique tracking numbers in WhatsApp chat.`);

  let matchedCount = 0;
  const matchedList: any[] = [];
  const notInDbList: any[] = [];

  for (const [trk, count] of foundTrackings.entries()) {
    const p = dbProducts.find(
      prod =>
        prod.trackingId.toUpperCase().includes(trk) ||
        trk.includes(prod.trackingId.toUpperCase() && prod.trackingId.length > 8 ? prod.trackingId.toUpperCase() : 'NOMATCH') ||
        (prod.shipperTracking && prod.shipperTracking.toUpperCase().includes(trk))
    );

    if (p) {
      matchedCount++;
      matchedList.push({
        trk,
        countInChat: count,
        productId: p.id,
        orderNumber: p.orderNumber,
        description: p.description.slice(0, 45),
        shippingStatus: p.shippingStatus,
        shipperConfirmed: p.shipperConfirmed,
        priceUsd: p.purchasePriceUsd
      });
    } else {
      notInDbList.push({ trk, countInChat: count });
    }
  }

  console.log(`Matched to DB Products: ${matchedCount} / ${foundTrackings.size}`);
  console.log(`Unmatched Trackings: ${notInDbList.length}`);

  fs.writeFileSync(
    'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\scratch\\chat_tracking_audit.json',
    JSON.stringify({
      totalUniqueTrackingsInChat: foundTrackings.size,
      matchedCount,
      unmatchedCount: notInDbList.length,
      matchedList,
      notInDbList: notInDbList.slice(0, 50)
    }, null, 2)
  );

  console.log('Saved to scratch/chat_tracking_audit.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
