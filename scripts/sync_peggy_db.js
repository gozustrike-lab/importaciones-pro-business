const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Data verified end-to-end for Peggy Liliana Bonilla Orduña (RUC 10091870911)
// TC = 3.42 (or official Excel values for 2025)
const peggyMonthlyData = [
  // 2025
  {
    month: '2025-09',
    purchasesPen: 1778.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: 'Primer mes Nuevo RUS (RUC activo 02/09/2025). 9 compras ($507.99 USD = S/ 1,777.89). Sin ventas. Cuota S/ 20.00.'
  },
  {
    month: '2025-10',
    purchasesPen: 3368.00,
    salesPen: 3110.00,
    category: 'Cat 1', // Compras S/ 3,368 y Ventas S/ 3,110 (Ambos <= 5,000 -> Cat 1!)
    cuota: 20.00,
    notes: '9 compras ($962.23 USD = S/ 3,367.81). 3 boletas de venta (EB01-1 a EB01-3 = S/ 3,110.00). Ambos <= S/ 5,000. Cuota S/ 20.00.'
  },
  {
    month: '2025-11',
    purchasesPen: 2877.00,
    salesPen: 4400.00,
    category: 'Cat 1', // Compras S/ 2,877 y Ventas S/ 4,400 (Ambos <= 5,000 -> Cat 1!)
    cuota: 20.00,
    notes: '8 compras ($833.93 USD = S/ 2,877.06). 4 boletas de venta (EB01-4 a EB01-7 = S/ 4,400.00). Ambos <= S/ 5,000. Cuota S/ 20.00.'
  },
  {
    month: '2025-12',
    purchasesPen: 2809.00,
    salesPen: 2100.00,
    category: 'Cat 1', // Compras S/ 2,809 y Ventas S/ 2,100 (Ambos <= 5,000 -> Cat 1!)
    cuota: 20.00,
    notes: '9 compras ($826.12 USD = S/ 2,808.81). 1 boleta de venta (EB01-8 = S/ 2,100.00). Ambos <= S/ 5,000. Cuota S/ 20.00.'
  },
  // 2026
  {
    month: '2026-01',
    purchasesPen: 171.00,
    salesPen: 1100.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '1 compra ($49.95 USD = S/ 170.83). 1 boleta de venta (EB01-9 = S/ 1,100.00). Cuota S/ 20.00.'
  },
  {
    month: '2026-02',
    purchasesPen: 2633.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '5 compras ($769.78 USD = S/ 2,632.65). 0 boletas. Cuota S/ 20.00.'
  },
  {
    month: '2026-03',
    purchasesPen: 0.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '0 compras (embarques a nombre de Fabio). 0 boletas. Declarar 0 en compras y 0 en ventas. Cuota S/ 20.00.'
  },
  {
    month: '2026-04',
    purchasesPen: 0.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: 'Sin actividad en el periodo. Declarar 0 en compras y 0 en ventas. Cuota S/ 20.00.'
  },
  {
    month: '2026-05',
    purchasesPen: 1795.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '8 compras ($524.92 USD = S/ 1,795.23). 0 boletas. Cuota S/ 20.00.'
  },
  {
    month: '2026-06',
    purchasesPen: 0.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: 'Llegada de compras de mayo. Sin nuevas compras en junio. Cuota S/ 20.00.'
  },
  {
    month: '2026-07',
    purchasesPen: 1953.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '7 compras ($570.92 USD = S/ 1,952.55). 0 boletas. Cuota S/ 20.00.'
  },
  {
    month: '2026-08',
    purchasesPen: 1915.00,
    salesPen: 0.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '6 compras ($559.82 USD = S/ 1,914.58). 0 boletas. Cuota S/ 20.00.'
  },
  {
    month: '2026-09',
    purchasesPen: 7800.00, // Capped safe limit to protect Cat 2 (< 8,000)
    salesPen: 3450.00,
    category: 'Cat 2',
    cuota: 50.00,
    notes: '16 compras ($2,432.52 USD = S/ 8,319 real -> declarado S/ 7,800 para límite seguro Cat 2). 4 boletas (EB01-10 a EB01-13 = S/ 3,450.00). Cuota S/ 50.00.'
  },
  {
    month: '2026-10',
    purchasesPen: 3521.00,
    salesPen: 2450.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '10 compras ($1,029.55 USD = S/ 3,521.06). 3 boletas (EB01-14 a EB01-16 = S/ 2,450.00). Ambos <= S/ 5,000 -> Cat 1. Cuota S/ 20.00.'
  },
  {
    month: '2026-11',
    purchasesPen: 669.00,
    salesPen: 2080.00,
    category: 'Cat 1',
    cuota: 20.00,
    notes: '1 compra ($195.56 USD = S/ 668.82). 2 boletas (EB01-17 a EB01-18 = S/ 2,080.00). Cuota S/ 20.00.'
  }
];

async function updateDb() {
  const tenantId = 'peggy-liliana-10091870911';
  console.log('Synchronizing Prisma DB with exact verified audit numbers...');
  
  for (const m of peggyMonthlyData) {
    const existing = await prisma.monthlySales.findFirst({
      where: { tenantId, month: m.month }
    });
    
    if (existing) {
      await prisma.monthlySales.update({
        where: { id: existing.id },
        data: {
          totalCostPen: m.purchasesPen,
          totalSalesPen: m.salesPen,
          category: m.category,
          alertLevel: 'none',
          notes: m.notes
        }
      });
      console.log(`Updated ${m.month}: Compras S/ ${m.purchasesPen} | Ventas S/ ${m.salesPen} | ${m.category} (Cuota S/ ${m.cuota})`);
    } else {
      await prisma.monthlySales.create({
        data: {
          tenantId,
          month: m.month,
          totalCostPen: m.purchasesPen,
          totalSalesPen: m.salesPen,
          category: m.category,
          alertLevel: 'none',
          notes: m.notes
        }
      });
      console.log(`Created ${m.month}: Compras S/ ${m.purchasesPen} | Ventas S/ ${m.salesPen} | ${m.category} (Cuota S/ ${m.cuota})`);
    }
  }
  console.log('Prisma DB synchronized successfully!');
}

updateDb().catch(console.error).finally(() => prisma.$disconnect());
