import 'dotenv/config';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const structuredList = require('../scratch/structured_shipments.json');

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found in DB');
    return;
  }
  console.log(`Using Tenant: ${tenant.name} (${tenant.id})`);

  // Filter 2026 shipments with CC or HAWB
  const shipments2026 = structuredList.filter((s: any) => s.ccCode || (s.hawb && s.noticeDate.includes('/26')));
  console.log(`Found ${shipments2026.length} candidate shipments from 2026.`);

  // Group by unique code (prefer ccCode, then hawb)
  const uniqueMap = new Map<string, any>();
  for (const s of shipments2026) {
    const key = s.ccCode || s.hawb;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, s);
    }
  }

  console.log(`Unique shipments to process: ${uniqueMap.size}`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const [key, s] of uniqueMap.entries()) {
    const isPeggy = s.consignee.toUpperCase().includes('PEGGY');
    const importerProfile = isPeggy ? 'peggy' : 'fabio';
    const consigneeName = isPeggy ? 'BONILLA ORDUÑA PEGGY LILIANA' : 'HERRERA BONILLA FABIO CESAR';
    const consigneeRuc = isPeggy ? '10091870911' : '10762026835';

    // Parse flight date
    let flightDate = new Date();
    let flightDayLabel = s.flightConfirmed || 'VUELO SHiPER';

    if (s.ccCode && s.ccCode.startsWith('CC26')) {
      const mm = parseInt(s.ccCode.slice(4, 6), 10) - 1;
      const dd = parseInt(s.ccCode.slice(6, 8), 10);
      flightDate = new Date(2026, mm, dd, 12, 0, 0);
    } else if (s.noticeDate) {
      const parts = s.noticeDate.split('/');
      if (parts.length === 3) {
        flightDate = new Date(2026, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10), 12, 0, 0);
      }
    }

    // Determine status
    let status = 'EN_LIMA';
    if (s.ccCode === 'CC261027111654' && isPeggy) {
      status = 'EN_ADUANAS';
    } else if (s.noticeDate && s.noticeDate.includes('11/4/26')) {
      status = 'EN_LIMA';
    } else {
      status = 'RECIBIDO';
    }

    const whatsappNotes = [
      s.notes ? s.notes : '',
      s.trackingUrl ? `Link Rastreo: ${s.trackingUrl}` : '',
      s.weightKg ? `Peso: ${s.weightKg} kg` : '',
      s.costUsd ? `Liquidación: $${s.costUsd}` : '',
      s.pickupLocation ? `Modalidad: ${s.pickupLocation}` : ''
    ].filter(Boolean).join(' | ');

    const code = s.ccCode || s.hawb || `EMB-${flightDate.toISOString().slice(0, 10)}-${importerProfile.toUpperCase()}`;

    const existing = await prisma.shipment.findUnique({
      where: { code }
    });

    if (existing) {
      await prisma.shipment.update({
        where: { code },
        data: {
          awbNumber: s.hawb || existing.awbNumber,
          status,
          flightDayLabel: s.flightConfirmed ? `VUELO ${s.flightConfirmed}` : existing.flightDayLabel,
          whatsappNotes: whatsappNotes || existing.whatsappNotes,
          notes: s.notes || existing.notes,
          arrivedLimaAt: existing.arrivedLimaAt || new Date(),
        }
      });
      updatedCount++;
    } else {
      await prisma.shipment.create({
        data: {
          code,
          flightDate,
          flightDayLabel: s.flightConfirmed ? `VUELO ${s.flightConfirmed}` : `VUELO ${flightDate.toLocaleDateString('es-PE')}`,
          importerProfile,
          consigneeName,
          consigneeRuc,
          courierName: 'ShiPer',
          awbNumber: s.hawb || '',
          status,
          totalItems: s.bultos || 1,
          totalFobUsd: 0,
          isUnder200: true,
          notes: s.notes || '',
          whatsappNotes,
          tenantId: tenant.id,
          arrivedLimaAt: new Date(),
        }
      });
      createdCount++;
    }
  }

  console.log(`Sync completed! Created: ${createdCount}, Updated: ${updatedCount}`);
  const finalCount = await prisma.shipment.count();
  console.log(`Total shipments in database now: ${finalCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
