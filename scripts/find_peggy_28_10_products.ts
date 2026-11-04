import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const chatPath = 'C:\\dev\\CLIENTES\\IMPORTACIONES USA - PERU\\WHATSAPP CHAT\\SHIPERHISTORIAL 04 11\\chat.txt';
const raw = fs.readFileSync(chatPath, 'utf8');

async function main() {
  // 1. Search chat for Peggy around late October
  const lines = raw.split('\n');
  console.log('--- RECENT MENTIONS OF PEGGY IN CHAT (October - November 2026) ---');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.toUpperCase().includes('PEGGY') && (l.includes('10/') || l.includes('11/'))) {
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 6); j++) {
        console.log(lines[j]);
      }
      console.log('-----------------------------------');
    }
  }

  // 2. Search products in DB
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { shippingStatus: { in: ['USA', 'TRANSITO_USA', 'EN_VUELO', 'EN_LIMA', 'ADUANAS', 'EN_ADUANA'] } },
        { purchaseDate: { gte: new Date('2026-10-01') } }
      ]
    },
    orderBy: { purchaseDate: 'desc' }
  });

  console.log(`\nFound ${products.length} recent/active products in DB.`);
  for (const p of products.slice(0, 15)) {
    console.log(`[${p.shippingStatus}] ${p.purchaseDate?.toISOString().slice(0, 10)} | Ord: ${p.orderNumber} | Trk: ${p.trackingId} | ${p.description.slice(0, 45)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
