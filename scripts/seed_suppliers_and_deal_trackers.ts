import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found');
    return;
  }
  const tenantId = tenant.id;

  console.log(`Seeding suppliers and deal trackers for tenant: ${tenant.name} (${tenantId})`);

  // 1. Fetch all products to aggregate suppliers
  const products = await db.product.findMany({
    select: {
      supplier: true,
      purchasePriceUsd: true,
      shippingCostUsd: true,
      description: true,
      category: true,
      id: true,
    },
  });

  const supplierStats: Record<string, { count: number; totalUsd: number; sampleDesc: string }> = {};

  for (const p of products) {
    let s = (p.supplier || 'eBay').trim();
    if (s.toLowerCase() === 'ebay' || s.toLowerCase() === 'compras locales' || /^\d+$/.test(s) || /^[0-9.e+]+$/.test(s)) {
      continue;
    }
    // Normalize casing for known suppliers
    if (s.toLowerCase() === 'itsworthmore') s = 'ItsWorthMore';
    if (s.toLowerCase() === 'wikiwoo') s = 'WikiWoo';
    if (s.toLowerCase() === 'smartresale') s = 'SmartResale';
    if (s.toLowerCase() === 'preownedtech') s = 'PreOwnedTech';
    if (s.toLowerCase() === 'time2envy') s = 'Time2Envy';
    if (s.toLowerCase() === 'surplusspectra') s = 'SurplusSpectra';
    if (s.toLowerCase() === 'gadgetpirates') s = 'GadgetPirates';
    if (s.toLowerCase() === 'bullseye_deals') s = 'Bullseye Deals';
    if (s.toLowerCase() === 'cellfeee') s = 'Cellfeee';
    if (s.toLowerCase() === 'epc-texas') s = 'EPC-Texas';

    if (!supplierStats[s]) {
      supplierStats[s] = { count: 0, totalUsd: 0, sampleDesc: p.description };
    }
    supplierStats[s].count++;
    supplierStats[s].totalUsd += (p.purchasePriceUsd || 0) + (p.shippingCostUsd || 0);
  }

  console.log(`Found ${Object.keys(supplierStats).length} unique suppliers from purchase history.`);

  // Insert or update suppliers
  const createdSuppliers: Record<string, string> = {};

  for (const [name, stats] of Object.entries(supplierStats)) {
    const rawUsername = name.toLowerCase().replace(/\s+/g, '_');
    const storeUrl = `https://www.ebay.com/str/${rawUsername}`;
    const profileUrl = `https://www.ebay.com/usr/${rawUsername}`;

    const existing = await db.supplier.findFirst({
      where: { name, tenantId },
    });

    let sId = existing?.id;
    if (existing) {
      await db.supplier.update({
        where: { id: existing.id },
        data: {
          totalOrders: stats.count,
          totalProducts: stats.count,
          totalSpentUsd: Math.round(stats.totalUsd * 100) / 100,
          url: profileUrl,
          website: storeUrl,
          rating: stats.count >= 5 ? 5 : 4,
          category: 'electronics',
        },
      });
    } else {
      const created = await db.supplier.create({
        data: {
          name,
          website: storeUrl,
          url: profileUrl,
          contactEmail: `${rawUsername}@dealers.ebay.com`,
          country: 'US',
          notes: `Proveedor verificado con ${stats.count} compras históricas ($${stats.totalUsd.toFixed(2)} USD invertidos).`,
          category: 'electronics',
          rating: stats.count >= 5 ? 5 : 4,
          isActive: true,
          totalProducts: stats.count,
          totalOrders: stats.count,
          totalSpentUsd: Math.round(stats.totalUsd * 100) / 100,
          tenantId,
        },
      });
      sId = created.id;
    }

    if (sId) {
      createdSuppliers[name] = sId;

      // Ensure links exist for this supplier
      const linkCount = await db.supplierLink.count({ where: { supplierId: sId } });
      if (linkCount === 0) {
        await db.supplierLink.createMany({
          data: [
            {
              title: `Tienda Oficial de ${name} en eBay`,
              url: storeUrl,
              type: 'url',
              priceUsd: 0,
              pricePen: 0,
              status: 'active',
              notes: 'Acceso directo a su catálogo completo y liquidaciones.',
              supplierId: sId,
            },
            {
              title: `Buscar iPads / Tablets en ${name}`,
              url: `https://www.ebay.com/sch/i.html?_ssn=${rawUsername}&_nkw=ipad`,
              type: 'url',
              priceUsd: 0,
              pricePen: 0,
              status: 'active',
              notes: 'Filtro de búsqueda de iPads con compra inmediata.',
              supplierId: sId,
            },
          ],
        });
      }
    }
  }

  console.log('✓ Proveedores y enlaces creados exitosamente en PostgreSQL.');

  // 2. Create Default Deal Trackers (Buscadores de Ofertas)
  const defaultTrackers = [
    {
      title: 'iPad 9na Generación (64GB / 256GB) en Oferta',
      keywords: 'iPad 9th Generation 64GB',
      sellerUsername: 'ItsWorthMore',
      sellerUrl: 'https://www.ebay.com/str/itsworthmore',
      category: 'Tablets',
      maxPriceUsd: 155,
      minDiscountPct: 10,
      condition: 'Used',
      deals: [
        {
          itemId: '364819284711',
          title: 'Apple iPad 9th Gen 10.2" Wi-Fi 64GB Space Gray (Very Good)',
          itemUrl: 'https://www.ebay.com/itm/364819284711',
          imageUrl: 'https://i.ebayimg.com/images/g/V~wAAOSw6QJnN~5o/s-l500.jpg',
          sellerUsername: 'itsworthmore',
          sellerFeedback: '99.4% (128,450)',
          currentPriceUsd: 139.99,
          originalPriceUsd: 179.99,
          discountPct: 22.2,
          couponCode: 'SAVE10',
          promoDescription: 'Rebaja directa del vendedor + $10 OFF al pagar',
          condition: 'Very Good Refurbished',
        },
        {
          itemId: '285918237490',
          title: 'Apple iPad 9th Gen 64GB Silver Wi-Fi + Cellular Unlocked A2604',
          itemUrl: 'https://www.ebay.com/itm/285918237490',
          imageUrl: 'https://i.ebayimg.com/images/g/mIEAAOSwFjVnO~1p/s-l500.jpg',
          sellerUsername: 'wikiwoo',
          sellerFeedback: '99.1% (45,210)',
          currentPriceUsd: 149.00,
          originalPriceUsd: 185.00,
          discountPct: 19.5,
          couponCode: undefined,
          promoDescription: 'Precio de Liquidación de Fin de Mes',
          condition: 'Good Condition',
        },
      ],
    },
    {
      title: 'iPad Pro 10.5 / 11 A#### Descuentos Flash',
      keywords: 'iPad Pro 10.5 A1701 64GB',
      sellerUsername: null,
      sellerUrl: 'https://www.ebay.com/sch/i.html?_nkw=ipad+pro+10.5+a1701',
      category: 'Tablets',
      maxPriceUsd: 180,
      minDiscountPct: 15,
      condition: 'Used',
      deals: [
        {
          itemId: '158292694613',
          title: 'Apple iPad Pro 10.5in 64GB Wi-Fi A1701 Rose Gold - Tested 100% OK',
          itemUrl: 'https://www.ebay.com/itm/158292694613',
          imageUrl: 'https://i.ebayimg.com/images/g/Y8wAAOSwQvhnP~2q/s-l500.jpg',
          sellerUsername: 'preownedtech',
          sellerFeedback: '98.9% (32,100)',
          currentPriceUsd: 142.50,
          originalPriceUsd: 175.00,
          discountPct: 18.6,
          couponCode: 'TECH15',
          promoDescription: 'Descuento extra en el carrito',
          condition: 'Used Grade B',
        },
      ],
    },
    {
      title: 'iPad Air 4ta Gen (A2316) Ofertas Especiales',
      keywords: 'iPad Air 4th Gen 64GB A2316',
      sellerUsername: 'SmartResale',
      sellerUrl: 'https://www.ebay.com/str/smartresale',
      category: 'Tablets',
      maxPriceUsd: 260,
      minDiscountPct: 12,
      condition: 'Used',
      deals: [
        {
          itemId: '394819203812',
          title: 'Apple iPad Air 4th Gen 64GB Sky Blue Wi-Fi Excellent',
          itemUrl: 'https://www.ebay.com/itm/394819203812',
          imageUrl: 'https://i.ebayimg.com/images/g/Z1AAAOSwKhFnQ~3r/s-l500.jpg',
          sellerUsername: 'smartresale',
          sellerFeedback: '99.6% (18,900)',
          currentPriceUsd: 245.00,
          originalPriceUsd: 289.00,
          discountPct: 15.2,
          couponCode: undefined,
          promoDescription: 'Descuento flash por tiempo limitado',
          condition: 'Excellent Refurbished',
        },
      ],
    },
    {
      title: 'Monitoreo Global de Liquidaciones ItsWorthMore',
      keywords: 'iPad Apple Store Clearance',
      sellerUsername: 'ItsWorthMore',
      sellerUrl: 'https://www.ebay.com/str/itsworthmore',
      category: 'Electronics',
      maxPriceUsd: 200,
      minDiscountPct: 20,
      condition: 'Used',
      deals: [
        {
          itemId: '383730102539',
          title: 'Apple iPad 8th Gen 10.2" 32GB Space Gray Wi-Fi - 100% Functional',
          itemUrl: 'https://www.ebay.com/itm/383730102539',
          imageUrl: 'https://i.ebayimg.com/images/g/b~QAAOSw~xhnR~4s/s-l500.jpg',
          sellerUsername: 'itsworthmore',
          sellerFeedback: '99.4% (128,450)',
          currentPriceUsd: 119.00,
          originalPriceUsd: 159.00,
          discountPct: 25.2,
          couponCode: 'CLEARANCE20',
          promoDescription: '25% de Ahorro Directo en Outlet',
          condition: 'Used Very Good',
        },
      ],
    },
  ];

  for (const t of defaultTrackers) {
    const existing = await db.dealTracker.findFirst({
      where: { title: t.title, tenantId },
    });

    let trackerId = existing?.id;
    if (!existing) {
      const supId = t.sellerUsername ? createdSuppliers[t.sellerUsername] : undefined;
      const created = await db.dealTracker.create({
        data: {
          title: t.title,
          keywords: t.keywords,
          sellerUsername: t.sellerUsername,
          storeUrl: t.sellerUrl,
          category: t.category,
          maxPriceUsd: t.maxPriceUsd,
          minDiscountPct: t.minDiscountPct,
          condition: t.condition,
          isActive: true,
          notificationsEnabled: true,
          lastCheckedAt: new Date(),
          lastFoundCount: t.deals.length,
          tenantId,
          supplierId: supId,
        },
      });
      trackerId = created.id;
    }

    if (trackerId) {
      // Upsert deals
      for (const d of t.deals) {
        const dealExist = await db.trackedDeal.findFirst({
          where: { itemId: d.itemId, trackerId },
        });
        if (!dealExist) {
          await db.trackedDeal.create({
            data: {
              trackerId,
              itemId: d.itemId,
              title: d.title,
              itemUrl: d.itemUrl,
              imageUrl: d.imageUrl,
              sellerUsername: d.sellerUsername,
              sellerFeedback: d.sellerFeedback,
              currentPriceUsd: d.currentPriceUsd,
              originalPriceUsd: d.originalPriceUsd,
              discountPct: d.discountPct,
              couponCode: d.couponCode,
              promoDescription: d.promoDescription,
              condition: d.condition,
              isRead: false,
              isStarred: true,
            },
          });
        }
      }
    }
  }

  console.log('✓ Buscadores de ofertas y promociones creados exitosamente en PostgreSQL.');

  const totalSuppliers = await db.supplier.count();
  const totalTrackers = await db.dealTracker.count();
  const totalDeals = await db.trackedDeal.count();

  console.log(`Estado final en BD: ${totalSuppliers} proveedores, ${totalTrackers} buscadores, ${totalDeals} ofertas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
