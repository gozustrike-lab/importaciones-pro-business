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
  const all = await prisma.product.findMany({ where: { isArchived: false } });
  console.log('ACTIVE PRODUCTS IN DB (Total ' + all.length + '):');
  
  const inShiper: any[] = [];
  const notInShiper: any[] = [];

  for (const p of all) {
    const match = shiperTrks.find(st => p.trackingId && (p.trackingId.includes(st) || st.includes(p.trackingId)));
    if (match) {
      inShiper.push(p);
    } else {
      notInShiper.push(p);
    }
  }

  console.log('In Shiper Miami (' + inShiper.length + ')');
  console.log('\nNOT in Shiper Miami screenshot (' + notInShiper.length + '):');
  for (const p of notInShiper) {
    console.log(' - Ord:', p.orderNumber, '|', p.courier, p.trackingId, '| Status:', p.shippingStatus, '| Arr:', p.actualArrival ? p.actualArrival.toISOString().slice(0, 10) : 'none', '|', p.importerProfile, '|', p.description.slice(0, 35));
  }
}

run().finally(() => prisma.$disconnect());
