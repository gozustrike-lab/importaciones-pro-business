import { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { getUserToken, getEbayConfig } from '../src/lib/ebay-account';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const prisma = new PrismaClient();

const SHIPER_TRACKINGS = [
  // Peggy (12)
  { trk: '383769867097', date: '09/22', name: 'PEGGY', weight: '0.9', carrier: 'FEDEX' },
  { trk: '9434636208192282284302', date: '09/23', name: 'PEGGY', weight: '0.85', carrier: 'USPS' },
  { trk: '383810188373', date: '09/24', name: 'PEGGY', weight: '0.75', carrier: 'FEDEX' },
  { trk: '1ZC9529D0322121977', date: '09/28', name: 'PEGGY', weight: '1.9', carrier: 'UPS' },
  { trk: '1Z14V5340334662831', date: '09/28', name: 'PEGGY', weight: '1.1', carrier: 'UPS' },
  { trk: '1Z14V5340324609006', date: '09/29', name: 'PEGGY', weight: '1.65', carrier: 'UPS' },
  { trk: '9400150105794102233309', date: '09/29', name: 'PEGGY', weight: '0.75', carrier: 'USPS' },
  { trk: '9400150105495103323777', date: '09/29', name: 'PEGGY', weight: '0.75', carrier: 'USPS' },
  { trk: '9400150206217928132260', date: '09/29', name: 'PEGGY', weight: '0.8', carrier: 'USPS' },
  { trk: '1ZC9529D0324359771', date: '09/30', name: 'PEGGY', weight: '1.9', carrier: 'UPS' },
  { trk: '383833691742', date: '09/30', name: 'PEGGY', weight: '2.45', carrier: 'FEDEX' },
  { trk: '1Z78Y5W70393237310', date: '10/01', name: 'PEGGY', weight: '2.35', carrier: 'UPS' },

  // Fabio (9)
  { trk: '9436208106245579767610', date: '09/17', name: 'FABIO', weight: '1.5', carrier: 'USPS' },
  { trk: '1Z0R2B760324495226', date: '09/23', name: 'FABIO', weight: '0.7', carrier: 'UPS' },
  { trk: '9434608106244558949658', date: '09/29', name: 'FABIO', weight: '1.25', carrier: 'USPS' },
  { trk: '383847078355', date: '09/29', name: 'FABIO', weight: '2.4', carrier: 'FEDEX' },
  { trk: '1Z14V5340320924511', date: '09/30', name: 'FABIO', weight: '0.8', carrier: 'UPS' },
  { trk: '383918781243', date: '10/01', name: 'FABIO', weight: '0.8', carrier: 'FEDEX' },
  { trk: '9434608106244603884132', date: '10/02', name: 'FABIO', weight: '1.15', carrier: 'USPS' },
  { trk: '1ZC9529D0305930518', date: '10/02', name: 'FABIO', weight: '1.9', carrier: 'UPS' },
  { trk: '9236290419992000051128', date: '10/02', name: 'FABIO', weight: '0.95', carrier: 'USPS' },
];

async function run() {
  const dbProducts = await prisma.product.findMany();
  console.log('--- AUDITORÍA CRUZADA: SHIPER MIAMI (21 PAQUETES) VS SISTEMA / EBAY ---');

  for (const s of SHIPER_TRACKINGS) {
    const matched = dbProducts.filter(p => 
      p.trackingId.includes(s.trk) || 
      (p.shipperTracking && p.shipperTracking.includes(s.trk)) ||
      s.trk.includes(p.trackingId && p.trackingId.length > 8 ? p.trackingId : '___NOMATCH___')
    );
    if (matched.length > 0) {
      for (const m of matched) {
        console.log(`[SHIPER MATCH] ${s.date} ${s.name} ${s.carrier} ${s.trk} (${s.weight} kg) -> Ord: ${m.orderNumber} | Archived: ${m.isArchived ? 'SI (Embarcado)' : 'NO (Activo)'} | ${m.description.slice(0, 40)}`);
      }
    } else {
      console.log(`[SHIPER NO MATCH IN DB] ${s.date} ${s.name} ${s.carrier} ${s.trk} (${s.weight} kg)`);
    }
  }

  console.log('\n--- VERIFICACIÓN DEL TRACKING PERDIDO: 383772352970 ---');
  const missing = dbProducts.find(p => p.trackingId.includes('383772352970') || p.orderNumber.includes('22-15154-01688'));
  console.log('En base de datos:', missing ? {
    order: missing.orderNumber,
    tracking: missing.trackingId,
    courier: missing.courier,
    isArchived: missing.isArchived,
    status: missing.shippingStatus,
    actualArrival: missing.actualArrival,
    recipient: missing.recipientName,
    desc: missing.description
  } : 'NO EXISTE');

  // Check all purchases for Peggy in active and recent
  console.log('\n--- TODOS LOS PEDIDOS DE PEGGY EN BASE DE DATOS (ACTIVAS) ---');
  const peggyActive = dbProducts.filter(p => !p.isArchived && ((p.importerProfile || '').toLowerCase() === 'peggy' || (p.recipientName || '').toLowerCase().includes('peggy') || (p.recipientName || '').toLowerCase().includes('orduña')));
  console.log(`Total activas de Peggy: ${peggyActive.length}`);
  for (const p of peggyActive) {
    console.log(` - Ord: ${p.orderNumber} | ${p.courier} ${p.trackingId} | Status: ${p.shippingStatus} | ShiperConf: ${p.shipperConfirmed} | ${p.description.slice(0, 45)}`);
  }

  console.log('\n--- TODOS LOS PEDIDOS DE PEGGY EN BASE DE DATOS (ARCHIVADAS RECIENTEMENTE) ---');
  const peggyArchived = dbProducts.filter(p => p.isArchived && ((p.importerProfile || '').toLowerCase() === 'peggy' || (p.recipientName || '').toLowerCase().includes('peggy') || (p.recipientName || '').toLowerCase().includes('orduña')));
  console.log(`Total archivadas de Peggy: ${peggyArchived.length}`);
}

run().finally(() => prisma.$disconnect());
