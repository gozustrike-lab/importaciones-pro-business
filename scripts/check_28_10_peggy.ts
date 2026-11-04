import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function check() {
  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { code: { contains: '28' } },
        { flightDayLabel: { contains: '28' } },
        { whatsappNotes: { contains: '28' } },
        { code: { contains: 'CC261027' } }
      ]
    }
  });

  console.log('Shipments found:');
  shipments.forEach(s => {
    console.log({
      id: s.id,
      code: s.code,
      profile: s.importerProfile,
      consignee: s.consigneeName,
      status: s.status,
      flightDayLabel: s.flightDayLabel,
      notes: s.notes,
      whatsappNotes: s.whatsappNotes
    });
  });
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
