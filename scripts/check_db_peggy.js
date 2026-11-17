const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.monthlySales.findMany({
    where: { tenantId: 'peggy-liliana-10091870911' },
    orderBy: { month: 'asc' }
  });
  console.log('--- Current DB Records for Peggy Liliana (RUC 10091870911) ---');
  for (const r of records) {
    console.log(
      `Period ${r.month}: Compras S/ ${Number(r.totalCostPen).toFixed(2)} | Ventas S/ ${Number(r.totalSalesPen).toFixed(2)} | Category: ${r.category} | Alert: ${r.alertLevel} | Notes: ${r.notes}`
    );
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
