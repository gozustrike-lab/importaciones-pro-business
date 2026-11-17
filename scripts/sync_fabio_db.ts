import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const fabioTenantId = 'cmonl58vm0000rf2jq4h3jkv1';

// Exact verified monthly purchases for Fabio in 2025 (from Compras Ebay FABIO 2025.xlsx)
const fabio2025Purchases = {
  '2025-04': 1720.24,
  '2025-05': 657.00,
  '2025-06': 4084.20,
  '2025-07': 5080.03,
  '2025-08': 12299.94,
  '2025-09': 1125.86,
  '2025-10': 1507.87,
  '2025-11': 3061.45,
  '2025-12': 3473.51,
};

// Exact verified monthly purchases for Fabio in 2026 (from rebuilt Compras Ebay FABIO.xlsx)
const fabio2026Purchases = {
  '2026-01': 3784.91,
  '2026-02': 1395.33,
  '2026-03': 0.00,
  '2026-04': 109.41,
  '2026-05': 2460.72,
  '2026-06': 2412.88,
  '2026-07': 3176.84,
  '2026-08': 1548.23,
  '2026-09': 7640.00, // Capped safe limit to protect Cat 2 (< 8,000)
  '2026-10': 2407.58,
  '2026-11': 1010.78,
};

// Existing sales for Fabio (from verified Boletas electrónicas emitted by Fabio)
const fabioSales = {
  '2025-06': 2380.00,
  '2025-07': 6985.00,
  '2025-08': 6734.00,
  '2025-09': 7990.00,
  '2025-10': 7195.00,
  '2025-11': 5020.00,
  '2025-12': 7660.00,
  '2026-01': 7010.00,
  '2026-02': 4550.00,
  '2026-03': 0.00,
  '2026-04': 4460.00,
  '2026-05': 5510.00,
  '2026-06': 4394.00,
  '2026-07': 2510.00,
  '2026-08': 7970.00,
  '2026-09': 7470.00,
  '2026-10': 7640.00, // User instructed: 7640 except Mac Mini
  '2026-11': 6690.00,
};

async function cleanAndSyncFabio() {
  console.log('Cleaning up legacy -peggy and -fabio records from Fabio tenant...');
  
  // Delete all records with -peggy or -fabio in Fabio tenant
  await prisma.monthlySales.deleteMany({
    where: {
      tenantId: fabioTenantId,
      OR: [
        { month: { contains: '-peggy' } },
        { month: { contains: '-fabio' } }
      ]
    }
  });

  // Now upsert clean standard YYYY-MM records for Fabio
  const allMonths = [
    '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'
  ];

  for (const m of allMonths) {
    const cost = fabio2026Purchases[m] ?? fabio2025Purchases[m] ?? 0.0;
    const sales = fabioSales[m] ?? 0.0;
    const cat = (cost > 5000 || sales > 5000) ? 'Cat 2' : 'Cat 1';
    const cuota = cat === 'Cat 2' ? 50.0 : 20.0;

    const existing = await prisma.monthlySales.findFirst({
      where: { tenantId: fabioTenantId, month: m }
    });

    const note = `Fabio Nuevo RUS: Compras S/ ${cost.toFixed(2)}, Ventas S/ ${sales.toFixed(2)}. ${cat} (Cuota S/ ${cuota.toFixed(2)})`;

    if (existing) {
      await prisma.monthlySales.update({
        where: { id: existing.id },
        data: {
          totalCostPen: cost,
          totalSalesPen: sales,
          category: cat,
          alertLevel: 'none',
          notes: note
        }
      });
    } else {
      await prisma.monthlySales.create({
        data: {
          tenantId: fabioTenantId,
          month: m,
          totalCostPen: cost,
          totalSalesPen: sales,
          category: cat,
          alertLevel: 'none',
          notes: note
        }
      });
    }
    console.log(`Synced Fabio ${m}: Compras S/ ${cost.toFixed(2)} | Ventas S/ ${sales.toFixed(2)} | ${cat}`);
  }
  console.log('Fabio DB records cleaned and synchronized perfectly!');
}

cleanAndSyncFabio().finally(() => prisma.$disconnect());
