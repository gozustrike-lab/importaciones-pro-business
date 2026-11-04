import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');

  const code = 'EMB-20261028-PEGGY';

  const existing = await prisma.shipment.findUnique({
    where: { code }
  });

  const flightDate = new Date(2026, 9, 28, 12, 0, 0); // 28 Oct 2026
  const data = {
    code,
    flightDate,
    flightDayLabel: 'VUELO 28/10',
    importerProfile: 'peggy',
    consigneeName: 'BONILLA ORDUÑA PEGGY LILIANA',
    consigneeRuc: '10091870911',
    courierName: 'ShiPer',
    awbNumber: '',
    status: 'EN_ADUANA', // 4. En Aduanas SUNAT (Canal Rojo)
    totalItems: 1,
    totalFobUsd: 0,
    isUnder200: true,
    notes: 'Canal Rojo / Revisión física SUNAT en Aduanas Lima (Confirmado por ShiPer 04/11)',
    whatsappNotes: 'CANAL ROJO / REVISIÓN EN ADUANAS SUNAT | Usuario preguntó: "¿El de Peggy está en aduanas aún en revisión?" -> ShiPer confirmó: "CORRECTO" (04/11/2026)',
    tenantId: tenant.id,
  };

  if (existing) {
    const updated = await prisma.shipment.update({
      where: { code },
      data,
    });
    console.log('Peggy 28/10 shipment updated:', updated);
  } else {
    const created = await prisma.shipment.create({
      data,
    });
    console.log('Peggy 28/10 shipment created:', created);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
