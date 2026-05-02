// ── Seed Script for ImportHub Perú ──
// Run with: DATABASE_URL="..." bunx tsx prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🌱 Seeding ImportHub Perú database...\n");

  // ── 1. Create Tenant ──
  console.log("📦 Creating tenant...");
  const tenant = await db.tenant.upsert({
    where: { ruc: "10762026835" },
    update: {},
    create: {
      name: "Importaciones Perú SAC",
      ruc: "10762026835",
      ownerName: "Fabio Herrera Bonilla",
      ownerEmail: "admin@importhub.pe",
      plan: "pro",
      isActive: true,
      maxUsers: 20,
      address: "Av. Javier Prado Este 4600, Surco",
      city: "Lima",
      phone: "+51 999 888 777",
    },
  });
  console.log(`   ✅ Tenant: ${tenant.name} (RUC: ${tenant.ruc})\n`);

  // ── 2. Create TENANT_ADMIN user ──
  console.log("👤 Creating tenant admin...");
  const adminPassword = await hashPassword("Admin1234");
  const adminUser = await db.user.upsert({
    where: { email: "admin@importhub.pe" },
    update: {},
    create: {
      email: "admin@importhub.pe",
      name: "Fabio Herrera Bonilla",
      password: adminPassword,
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
      isActive: true,
    },
  });
  console.log(`   ✅ Admin: ${adminUser.email} (${adminUser.role})\n`);

  // ── 3. Create SUPER_ADMIN user ──
  console.log("🔐 Creating super admin...");
  const superAdminPassword = await hashPassword("SuperAdmin123");
  const superAdmin = await db.user.upsert({
    where: { email: "superadmin@importhub.pe" },
    update: {},
    create: {
      email: "superadmin@importhub.pe",
      name: "Super Admin",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  console.log(`   ✅ Super Admin: ${superAdmin.email} (${superAdmin.role})\n`);

  // ── 4. Create NRUS Config ──
  console.log("⚙️  Creating NRUS config...");
  const nrusConfig = await db.nRUSConfig.upsert({
    where: { id: tenant.id + "-nrus" },
    update: {},
    create: {
      id: tenant.id + "-nrus",
      ruc: "10762026835",
      businessName: "Importaciones Perú SAC",
      cat1Threshold: 5000,
      cat2Threshold: 8000,
      igvRate: 0.18,
      adValoremRate: 0.04,
      perceptionRate: 0.10,
      fobExemption: 200,
      tenantId: tenant.id,
    },
  });
  console.log(`   ✅ NRUS Config created\n`);

  // ── 5. Create Sample Clients ──
  console.log("👥 Creating sample clients...");
  const clientsData = [
    { fullName: "Carlos Mendoza Torres", dniRuc: "45678912", celular: "987654321", email: "carlos.mendoza@gmail.com", ciudad: "Lima", direccion: "Av. Arequipa 1200, Lima Centro" },
    { fullName: "María Elena Quispe Ramos", dniRuc: "34567891", celular: "956789123", email: "maria.quispe@yahoo.com", ciudad: "Arequipa", direccion: "Calle Bolívar 345, Cercado" },
    { fullName: "Jorge Luis Castro Huamán", dniRuc: "23456789", celular: "945678912", email: "jorge.castro@hotmail.com", ciudad: "Cusco", direccion: "Av. El Sol 567, Cusco" },
    { fullName: "Ana Patricia Flores Díaz", dniRuc: "56789123", celular: "934567891", email: "ana.flores@outlook.com", ciudad: "Trujillo", direccion: "Jr. Pizarro 890, Trujillo" },
    { fullName: "Roberto Sánchez Vargas", dniRuc: "67891234", celular: "923456789", email: "roberto.sv@gmail.com", ciudad: "Lima", direccion: "Av. Angamos 456, Miraflores" },
  ];

  const clients = [];
  for (const c of clientsData) {
    const client = await db.client.upsert({
      where: { id: `client-${c.dniRuc}` },
      update: {},
      create: {
        id: `client-${c.dniRuc}`,
        ...c,
        isFrequent: c.ciudad === "Lima",
        totalPurchases: Math.floor(Math.random() * 5),
        totalSpent: Math.floor(Math.random() * 8000),
        tenantId: tenant.id,
      },
    });
    clients.push(client);
  }
  console.log(`   ✅ ${clients.length} clients created\n`);

  // ── 6. Create Sample Products ──
  console.log("📦 Creating sample products...");
  const productsData = [
    {
      id: "prod-ipad-air-5",
      description: "Apple iPad Air 5ta Gen 64GB WiFi Color Azul - Excelente estado",
      category: "iPad",
      model: "iPad Air 5",
      color: "Azul",
      capacity: "64GB",
      grade: "A",
      condition: "Like New",
      purchasePriceUsd: 389.99,
      shippingCostUsd: 25.00,
      shippingStatus: "Perú",
      courier: "DHL Express",
      trackingId: "DHL-2024-PE-001",
      supplier: "eBay",
      orderNumber: "EBAY-302145678",
      notes: "eBay itemId: v1|265789012345 - Incluye funda y cargador original",
    },
    {
      id: "prod-macbook-pro-14",
      description: "Apple MacBook Pro 14\" M1 Pro 16GB/512GB SSD Space Gray",
      category: "Laptop",
      model: "MacBook Pro 14 M1 Pro",
      color: "Space Gray",
      capacity: "512GB",
      grade: "A",
      condition: "Refurbished",
      purchasePriceUsd: 1450.00,
      shippingCostUsd: 45.00,
      shippingStatus: "En Tránsito",
      courier: "FedEx International",
      trackingId: "FDX-2024-PE-002",
      supplier: "eBay",
      orderNumber: "EBAY-302987654",
      notes: "eBay itemId: v1|156789012345 - Battery 95% health, 120 cycles",
    },
    {
      id: "prod-iphone-15-pro",
      description: "Apple iPhone 15 Pro Max 256GB Natural Titanium Desbloqueado",
      category: "iPhone",
      model: "iPhone 15 Pro Max",
      color: "Natural Titanium",
      capacity: "256GB",
      grade: "A",
      condition: "Excellent",
      purchasePriceUsd: 879.99,
      shippingCostUsd: 30.00,
      shippingStatus: "USA",
      courier: "UPS Standard",
      trackingId: "UPS-2024-PE-003",
      supplier: "eBay",
      orderNumber: "EBAY-303456789",
      notes: "eBay itemId: v1|196789012345 - Desbloqueado para cualquier operador",
    },
    {
      id: "prod-ipad-pro-11",
      description: "Apple iPad Pro 11\" M2 128GB WiFi + Cellular Silver",
      category: "iPad",
      model: "iPad Pro 11 M2",
      color: "Silver",
      capacity: "128GB",
      grade: "B",
      condition: "Good",
      purchasePriceUsd: 520.00,
      shippingCostUsd: 28.00,
      shippingStatus: "Perú",
      courier: "DHL Express",
      trackingId: "DHL-2024-PE-004",
      supplier: "eBay",
      orderNumber: "EBAY-304567890",
      notes: "eBay itemId: v1|225789012345 - Ligeros rayones en la parte trasera",
    },
    {
      id: "prod-macbook-air-m2",
      description: "Apple MacBook Air 13\" M2 8GB/256GB Midnight - Grade B",
      category: "Laptop",
      model: "MacBook Air 13 M2",
      color: "Midnight",
      capacity: "256GB",
      grade: "B",
      condition: "Very Good",
      purchasePriceUsd: 699.99,
      shippingCostUsd: 35.00,
      shippingStatus: "En Tránsito",
      courier: "FedEx International",
      trackingId: "FDX-2024-PE-005",
      supplier: "eBay",
      orderNumber: "EBAY-305678901",
      notes: "eBay itemId: v1|186789012345 - Pequeña marca en la tapa, funciona perfecto",
    },
    {
      id: "prod-iphone-14-pro",
      description: "Apple iPhone 14 Pro 128GB Deep Purple Unlocked",
      category: "iPhone",
      model: "iPhone 14 Pro",
      color: "Deep Purple",
      capacity: "128GB",
      grade: "A",
      condition: "Like New",
      purchasePriceUsd: 649.00,
      shippingCostUsd: 25.00,
      shippingStatus: "Entregado",
      courier: "UPS Express",
      trackingId: "UPS-2024-PE-006",
      supplier: "eBay",
      orderNumber: "EBAY-306789012",
      notes: "eBay itemId: v1|215789012345 - Con caja original y accesorios",
    },
    {
      id: "prod-ipad-mini-6",
      description: "Apple iPad Mini 6ta Gen 64GB WiFi Starlight - Grade B",
      category: "iPad",
      model: "iPad Mini 6",
      color: "Starlight",
      capacity: "64GB",
      grade: "B",
      condition: "Good",
      purchasePriceUsd: 299.99,
      shippingCostUsd: 22.00,
      shippingStatus: "USA",
      courier: "USPS Priority",
      trackingId: "USPS-2024-PE-007",
      supplier: "eBay",
      orderNumber: "EBAY-307890123",
      notes: "eBay itemId: v1|245789012345 - Pantalla sin marcas, carcasa con desgaste leve",
    },
    {
      id: "prod-iphone-13",
      description: "Apple iPhone 13 128GB Midnight Factory Unlocked - Grade A",
      category: "iPhone",
      model: "iPhone 13",
      color: "Midnight",
      capacity: "128GB",
      grade: "A",
      condition: "Excellent",
      purchasePriceUsd: 399.00,
      shippingCostUsd: 20.00,
      shippingStatus: "Perú",
      courier: "DHL Express",
      trackingId: "DHL-2024-PE-008",
      supplier: "eBay",
      orderNumber: "EBAY-308901234",
      notes: "eBay itemId: v1|255789012345 - Bateria 98%, como nuevo",
    },
  ];

  const products = [];
  for (const p of productsData) {
    const purchaseDate = new Date();
    purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 60));

    const exchangeRate = 3.70;
    const purchasePen = p.purchasePriceUsd * exchangeRate;
    const shippingPen = p.shippingCostUsd * exchangeRate;

    // Simplified tax calculation (adValorem + IGV + perception)
    let taxPen = 0;
    if (p.purchasePriceUsd > 200) {
      const adValorem = p.purchasePriceUsd * 0.04;
      const baseIgv = p.purchasePriceUsd + adValorem + p.shippingCostUsd;
      const igv = baseIgv * 0.18;
      const perception = baseIgv * 0.10;
      taxPen = (adValorem + igv + perception) * exchangeRate;
    }
    const totalCostPen = purchasePen + shippingPen + taxPen;

    const product = await db.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        purchaseDate,
        orderNumber: p.orderNumber,
        supplier: p.supplier,
        courier: p.courier,
        trackingId: p.trackingId,
        shippingStatus: p.shippingStatus,
        description: p.description,
        category: p.category,
        model: p.model,
        color: p.color,
        capacity: p.capacity,
        grade: p.grade,
        condition: p.condition,
        purchasePriceUsd: p.purchasePriceUsd,
        shippingCostUsd: p.shippingCostUsd,
        exchangeRate,
        totalCostPen: Math.round(totalCostPen * 100) / 100,
        taxAmountPen: Math.round(taxPen * 100) / 100,
        notes: p.notes,
        quantity: 1,
        tenantId: tenant.id,
      },
    });
    products.push(product);
  }
  console.log(`   ✅ ${products.length} products created\n`);

  // ── 7. Create Quality Checks ──
  console.log("✅ Creating quality checks...");
  for (let i = 0; i < 5; i++) {
    const p = products[i];
    await db.qualityCheck.create({
      data: {
        productId: p.id,
        screenOk: true,
        touchscreenOk: i < 4,
        buttonsOk: true,
        speakersOk: true,
        microphoneOk: true,
        cameraOk: true,
        portsOk: i < 4,
        wifiOk: true,
        bluetoothOk: true,
        keyboardOk: p.category === "Laptop",
        trackpadOk: p.category === "Laptop",
        housingOk: p.grade === "A",
        batteryOk: i < 4,
        chargerIncluded: i < 3,
        originalBox: i < 2,
        passed: p.grade === "A" || i === 2,
        inspector: "Fabio Herrera",
        notes: p.grade === "A" ? "Producto en excelente estado, pasa control de calidad completo." : "Algunas marcas menores en la carcasa, funcionalmente perfecto.",
      },
    });
  }
  console.log(`   ✅ 5 quality checks created\n`);

  // ── 8. Create Tracking Updates ──
  console.log("🚚 Creating tracking updates...");
  const trackingTemplates = [
    { productId: products[0].id, status: "USA", location: "Miami, FL", description: "Paquete recibido en bodega de Miami" },
    { productId: products[0].id, status: "En Tránsito", location: "Panamá", description: "En tránsito internacional - Panamá" },
    { productId: products[0].id, status: "Perú", location: "Lima, Perú", description: "Llegada a Lima - En aduanas" },
    { productId: products[0].id, status: "Perú", location: "Lima, Perú", description: "Despachado por Aduanas - Listo para entrega" },

    { productId: products[1].id, status: "USA", location: "Los Ángeles, CA", description: "Paquete despachado por el vendedor" },
    { productId: products[1].id, status: "En Tránsito", location: "Miami, FL", description: "En tránsito hacia Sudamérica" },

    { productId: products[2].id, status: "USA", location: "New York, NY", description: "Paquete recibido en centro de distribución" },

    { productId: products[4].id, status: "USA", location: "San José, CA", description: "Shipped from eBay seller" },
    { productId: products[4].id, status: "En Tránsito", location: "Miami, FL", description: "In transit to Peru" },

    { productId: products[5].id, status: "USA", location: "Chicago, IL", description: "Package received at distribution center" },
    { productId: products[5].id, status: "En Tránsito", location: "Panamá", description: "In international transit" },
    { productId: products[5].id, status: "Perú", location: "Lima, Perú", description: "Arrived in Lima customs" },
    { productId: products[5].id, status: "Entregado", location: "Lima, Perú", description: "Entregado al cliente - Roberto Sánchez" },
  ];

  for (const t of trackingTemplates) {
    const daysAgo = Math.floor(Math.random() * 45);
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);
    await db.trackingUpdate.create({
      data: {
        productId: t.productId,
        status: t.status,
        location: t.location,
        description: t.description,
        timestamp,
      },
    });
  }
  console.log(`   ✅ ${trackingTemplates.length} tracking updates created\n`);

  // ── 9. Create Sample Sales ──
  console.log("💰 Creating sample sales...");
  const salesData = [
    {
      productId: products[5].id, // iPhone 14 Pro
      clientId: clients[0].id,   // Carlos Mendoza
      salePricePen: 3850.00,
      costMarketingPen: 80.00,
      costOperativePen: 30.00,
      saleChannel: "MercadoLibre",
      paymentMethod: "Yape",
      deliveryStatus: "Entregado",
    },
    {
      productId: products[7].id, // iPhone 13
      clientId: clients[3].id,   // Ana Patricia Flores
      salePricePen: 2350.00,
      costMarketingPen: 50.00,
      costOperativePen: 25.00,
      saleChannel: "WhatsApp",
      paymentMethod: "Transferencia",
      deliveryStatus: "Entregado",
    },
    {
      productId: products[0].id, // iPad Air 5
      clientId: clients[4].id,   // Roberto Sánchez
      salePricePen: 2100.00,
      costMarketingPen: 45.00,
      costOperativePen: 20.00,
      saleChannel: "Tienda",
      paymentMethod: "Efectivo",
      deliveryStatus: "En camino",
    },
  ];

  const sales = [];
  for (const s of salesData) {
    const product = products.find((p) => p.id === s.productId)!;
    const saleDate = new Date();
    saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));
    const deliveryDate = s.deliveryStatus === "Entregado" ? new Date(saleDate.getTime() + 3 * 86400000) : null;

    const costAcquisitionPen = product.totalCostPen;
    const netProfitPen = s.salePricePen - costAcquisitionPen - s.costMarketingPen - s.costOperativePen;
    const profitMargin = s.salePricePen > 0 ? (netProfitPen / s.salePricePen) * 100 : 0;

    const sale = await db.sale.create({
      data: {
        saleDate,
        saleChannel: s.saleChannel,
        productId: s.productId,
        clientId: s.clientId,
        salePricePen: s.salePricePen,
        costAcquisitionPen,
        costMarketingPen: s.costMarketingPen,
        costOperativePen: s.costOperativePen,
        netProfitPen: Math.round(netProfitPen * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        status: "Completada",
        paymentMethod: s.paymentMethod,
        warrantyMonths: 3,
        warrantyNotes: "Garantía de tienda 3 meses",
        deliveryStatus: s.deliveryStatus,
        deliveryDate,
        tenantId: tenant.id,
      },
    });
    sales.push(sale);
  }
  console.log(`   ✅ ${sales.length} sales created\n`);

  // ── 10. Create Monthly Sales Records ──
  console.log("📊 Creating monthly sales records...");
  const months = ["2024-10", "2024-11", "2024-12", "2025-01"];
  const monthlyData = [
    { month: months[0], totalSalesPen: 3200, totalCostPen: 1800, category: "Cat 1", alertLevel: "none" },
    { month: months[1], totalSalesPen: 4500, totalCostPen: 2600, category: "Cat 1", alertLevel: "none" },
    { month: months[2], totalSalesPen: 6800, totalCostPen: 3900, category: "Cat 2", alertLevel: "warning" },
    { month: months[3], totalSalesPen: 8300, totalCostPen: 4700, category: "Cat 2", alertLevel: "danger" },
  ];

  for (const m of monthlyData) {
    const existing = await db.monthlySales.findFirst({
      where: { tenantId: tenant.id, month: m.month },
    });
    if (!existing) {
      await db.monthlySales.create({
        data: {
          month: m.month,
          totalSalesPen: m.totalSalesPen,
          totalCostPen: m.totalCostPen,
          category: m.category,
          alertLevel: m.alertLevel,
          notes: m.alertLevel !== "none" ? `Ventas cercanas al límite de ${m.category}` : "Ventas dentro del rango normal",
          tenantId: tenant.id,
        },
      });
    }
  }
  console.log(`   ✅ ${monthlyData.length} monthly records created\n`);

  // ── Summary ──
  console.log("═══════════════════════════════════════════");
  console.log("   ✅ Seeding completed successfully!");
  console.log("═══════════════════════════════════════════");
  console.log("\n📧 Login Credentials:");
  console.log("   ┌─────────────────────────────────────────────┐");
  console.log("   │ Tenant Admin:                               │");
  console.log("   │   Email:    admin@importhub.pe              │");
  console.log("   │   Password: Admin1234                       │");
  console.log("   ├─────────────────────────────────────────────┤");
  console.log("   │ Super Admin:                                │");
  console.log("   │   Email:    superadmin@importhub.pe         │");
  console.log("   │   Password: SuperAdmin123                   │");
  console.log("   └─────────────────────────────────────────────┘");
  console.log("\n📊 Database Summary:");
  const userCount = await db.user.count();
  const productCount = await db.product.count();
  const clientCount = await db.client.count();
  const saleCount = await db.sale.count();
  const qualityCount = await db.qualityCheck.count();
  const trackingCount = await db.trackingUpdate.count();
  const monthlyCount = await db.monthlySales.count();

  console.log(`   Users:            ${userCount}`);
  console.log(`   Products:         ${productCount}`);
  console.log(`   Clients:          ${clientCount}`);
  console.log(`   Sales:            ${saleCount}`);
  console.log(`   Quality Checks:   ${qualityCount}`);
  console.log(`   Tracking Updates: ${trackingCount}`);
  console.log(`   Monthly Records:  ${monthlyCount}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
