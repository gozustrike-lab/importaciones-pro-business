import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const chatPath = 'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\WHATSAPP CHAT\\SHIPERHISTORIAL 04 11\\chat.txt';
const raw = fs.readFileSync(chatPath, 'utf8');

async function main() {
  const shipments = await prisma.shipment.findMany();
  const products = await prisma.product.findMany();

  console.log(`Shipments: ${shipments.length}, Products: ${products.length}`);

  // Let's inspect products where shipperTracking or trackingId was mentioned near an embarque or in chat
  // In the chat, when Shiper confirms tracking or when user sends pre-alerta
  let linkedCount = 0;

  for (const s of shipments) {
    // If shipment has CC code, check if there are products with notes or trackings
    // or if we already linked products
    const alreadyLinked = products.filter(p => p.shipmentId === s.id);
    if (alreadyLinked.length > 0) {
      console.log(`Shipment ${s.code} already has ${alreadyLinked.length} products linked.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
