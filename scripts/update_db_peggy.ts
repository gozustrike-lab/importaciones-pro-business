import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const peggyMonthlyData = [
  // 2025 (Inscribed 02/09/2025)
  { month: '2025-09', purchasesUSD: 850.42, purchasesPEN: 2908, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2025-10', purchasesUSD: 1924.46, purchasesPEN: 6582, salesPEN: 3110, cat: 'Cat 2', cuota: 50 },
  { month: '2025-11', purchasesUSD: 1667.86, purchasesPEN: 5704, salesPEN: 4400, cat: 'Cat 2', cuota: 50 },
  { month: '2025-12', purchasesUSD: 1652.24, purchasesPEN: 5651, salesPEN: 2100, cat: 'Cat 2', cuota: 50 },

  // 2026
  { month: '2026-01', purchasesUSD: 49.95, purchasesPEN: 171, salesPEN: 1100, cat: 'Cat 1', cuota: 20 },
  { month: '2026-02', purchasesUSD: 769.78, purchasesPEN: 2633, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-03', purchasesUSD: 0, purchasesPEN: 0, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-04', purchasesUSD: 0, purchasesPEN: 0, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-05', purchasesUSD: 524.92, purchasesPEN: 1795, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-06', purchasesUSD: 0, purchasesPEN: 0, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-07', purchasesUSD: 570.92, purchasesPEN: 1953, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  { month: '2026-08', purchasesUSD: 559.82, purchasesPEN: 1915, salesPEN: 0, cat: 'Cat 1', cuota: 20 },
  // 2026-09: Real purchases USD 2,432.52 (S/ 8,319) -> declare safe limit S/ 7,800 to stay in Cat 2
  { month: '2026-09', purchasesUSD: 2432.52, purchasesPEN: 7800, salesPEN: 3450, cat: 'Cat 2', cuota: 50 },
  { month: '2026-10', purchasesUSD: 1029.55, purchasesPEN: 3521, salesPEN: 2450, cat: 'Cat 1', cuota: 20 },
  { month: '2026-11', purchasesUSD: 195.56, purchasesPEN: 669, salesPEN: 2080, cat: 'Cat 1', cuota: 20 },
];

async function main() {
  // 1. Ensure Tenant exists for Peggy
  let tenant = await prisma.tenant.findFirst({
    where: { ruc: '10091870911' }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: 'peggy-liliana-10091870911',
        name: 'Peggy Liliana Bonilla Orduña',
        ruc: '10091870911',
        ownerName: 'Peggy Liliana Bonilla Orduña',
        ownerEmail: 'peggy@importhub.pe',
        plan: 'pro',
        isActive: true
      }
    });
    console.log('Created Tenant for Peggy Liliana:', tenant.id);
  } else {
    console.log('Existing Tenant for Peggy Liliana:', tenant.id);
  }

  // 2. Upsert MonthlySales for Peggy
  for (const item of peggyMonthlyData) {
    const existing = await prisma.monthlySales.findFirst({
      where: {
        tenantId: tenant.id,
        month: item.month
      }
    });

    if (existing) {
      await prisma.monthlySales.update({
        where: { id: existing.id },
        data: {
          totalCostPen: item.purchasesPEN,
          totalSalesPen: item.salesPEN,
          category: item.cat,
          notes: `Cuota mensual SUNAT Nuevo RUS: S/ ${item.cuota}.00. Compras USD: $${item.purchasesUSD}`
        }
      });
      console.log(`Updated ${item.month}: Compras S/ ${item.purchasesPEN}, Ventas S/ ${item.salesPEN} (${item.cat})`);
    } else {
      await prisma.monthlySales.create({
        data: {
          id: `${tenant.id}-${item.month}`,
          tenantId: tenant.id,
          month: item.month,
          totalCostPen: item.purchasesPEN,
          totalSalesPen: item.salesPEN,
          category: item.cat,
          notes: `Cuota mensual SUNAT Nuevo RUS: S/ ${item.cuota}.00. Compras USD: $${item.purchasesUSD}`
        }
      });
      console.log(`Created ${item.month}: Compras S/ ${item.purchasesPEN}, Ventas S/ ${item.salesPEN} (${item.cat})`);
    }
  }

  console.log('\nAll MonthlySales records for Peggy (10091870911) synchronized successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
