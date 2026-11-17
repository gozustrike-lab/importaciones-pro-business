import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.monthlySales.findMany({
    where: { tenantId: 'cmonl58vm0000rf2jq4h3jkv1' },
    orderBy: { month: 'asc' }
  });
  console.log(`Fabio monthly records in DB (${records.length} records):`);
  for (const r of records) {
    console.log(`Month: ${r.month} | Compras S/ ${r.totalCostPen} | Ventas S/ ${r.totalSalesPen} | Cat: ${r.category} | Notes: ${r.notes}`);
  }
}

main().finally(() => prisma.$disconnect());
