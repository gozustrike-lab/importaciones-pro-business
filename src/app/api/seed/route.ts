import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/seed - Seed sample data (creates demo tenant + user + products)
export async function POST() {
  try {
    const existingProducts = await db.product.count();
    if (existingProducts > 0) {
      return NextResponse.json(
        { message: "Los datos de ejemplo ya existen.", existingCount: existingProducts },
        { status: 400 }
      );
    }

    // 1. Create demo tenant
    const tenant = await db.tenant.create({
      data: {
        name: "Importaciones Perú SAC",
        ruc: "10762026835",
        ownerName: "Fabio Herrera Bonilla",
        ownerEmail: "admin@importhub.pe",
        plan: "pro",
      },
    });

    // 2. Create admin user for demo tenant
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.default.hash("Demo1234", 12);

    const adminUser = await db.user.create({
      data: {
        email: "admin@importhub.pe",
        name: "Fabio Herrera Bonilla",
        password: hashedPassword,
        role: "TENANT_ADMIN",
        tenantId: tenant.id,
      },
    });

    // 3. Create SUPER_ADMIN user
    const superAdminPassword = await bcrypt.default.hash("SuperAdmin123", 12);
    await db.user.create({
      data: {
        email: "superadmin@importhub.pe",
        name: "Super Admin",
        password: superAdminPassword,
        role: "SUPER_ADMIN",
      },
    });

    // 4. Create NRUS config
    await db.nRUSConfig.create({
      data: {
        ruc: "10762026835", businessName: "Importaciones Perú",
        cat1Threshold: 5000, cat2Threshold: 8000,
        igvRate: 0.18, adValoremRate: 0.04,
        perceptionRate: 0.10, fobExemption: 200,
        tenantId: tenant.id,
      },
    });

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 5. Create clients
    const client1 = await db.client.create({ data: { fullName: "Carlos Mendoza Torres", dniRuc: "45678912", celular: "987 654 321", email: "carlos.mendoza@email.com", ciudad: "Lima", direccion: "Av. Arequipa 1234, Lince", notas: "Cliente frecuente, prefiere productos Apple", tenantId: tenant.id } });
    const client2 = await db.client.create({ data: { fullName: "María López García", dniRuc: "34567891", celular: "956 789 123", email: "maria.lopez@email.com", ciudad: "Arequipa", direccion: "Calle Bolívar 567", tenantId: tenant.id } });
    const client3 = await db.client.create({ data: { fullName: "José Ramírez Castro", dniRuc: "23456789", celular: "945 678 901", email: "", ciudad: "Cusco", notas: "Compró MacBook para uso profesional", tenantId: tenant.id } });
    const client4 = await db.client.create({ data: { fullName: "Ana Torres Vargas", dniRuc: "56789012", celular: "934 567 890", email: "ana.torres@email.com", ciudad: "Lima", direccion: "Jr. de la Unión 890", tenantId: tenant.id } });
    const client5 = await db.client.create({ data: { fullName: "Pedro Sánchez Flores", dniRuc: "67890123", celular: "923 456 789", email: "pedro.sanchez@email.com", ciudad: "Trujillo", notas: "Interesado en laptops", tenantId: tenant.id } });

    // 6. Create products
    const products = await db.product.createMany({
      data: [
        { purchaseDate: threeMonthsAgo, orderNumber: "EBAY-2024-001", supplier: "eBay", courier: "FedEx", trackingId: "FX-789456123", shippingStatus: "Vendido", estimatedArrival: new Date(threeMonthsAgo.getTime() + 20*24*60*60*1000), actualArrival: new Date(threeMonthsAgo.getTime() + 18*24*60*60*1000), description: "iPad Air 5ta Gen 256GB WiFi Color Azul", category: "iPad", model: "iPad Air 5", color: "Azul", capacity: "256GB", grade: "A", condition: "Usado - Like New", serialNumber: "F5K9Q2X7NM", screenStatus: "Perfecto", batteryHealth: "96%", batteryCycles: 45, qualityPassed: true, purchasePriceUsd: 380, shippingCostUsd: 35, advertisingCostUsd: 5, exchangeRate: 3.72, totalCostPen: 1788.52, taxAmountPen: 324.36, adValoremPen: 56.54, igvPen: 253.11, perceptionPen: 14.61, salePricePen: 2850, saleDate: new Date(threeMonthsAgo.getTime() + 25*24*60*60*1000), saleChannel: "MercadoLibre", profitPen: 1061.48, profitMargin: 37.24, tenantId: tenant.id },
        { purchaseDate: twoMonthsAgo, orderNumber: "EBAY-2024-002", supplier: "eBay", courier: "DHL", trackingId: "DHL-456789123", shippingStatus: "Vendido", estimatedArrival: new Date(twoMonthsAgo.getTime() + 15*24*60*60*1000), actualArrival: new Date(twoMonthsAgo.getTime() + 14*24*60*60*1000), description: "MacBook Pro 13\" M2 8GB/256GB SSD Gris Espacial", category: "Laptop", model: "MacBook Pro 13 M2", color: "Space Gray", capacity: "256GB", grade: "A", condition: "Usado - Refurbished", serialNumber: "C02G95X7MD6N", screenStatus: "Perfecto", batteryHealth: "92%", batteryCycles: 120, qualityPassed: true, purchasePriceUsd: 750, shippingCostUsd: 45, advertisingCostUsd: 10, exchangeRate: 3.71, totalCostPen: 3294.28, taxAmountPen: 565.67, adValoremPen: 111.08, igvPen: 423.33, perceptionPen: 31.26, salePricePen: 5200, saleDate: new Date(twoMonthsAgo.getTime() + 20*24*60*60*1000), saleChannel: "Tienda", profitPen: 1905.72, profitMargin: 36.65, tenantId: tenant.id },
        { purchaseDate: oneMonthAgo, orderNumber: "EBAY-2024-003", supplier: "eBay", courier: "FedEx", trackingId: "FX-321654987", shippingStatus: "Vendido", estimatedArrival: new Date(oneMonthAgo.getTime() + 12*24*60*60*1000), actualArrival: new Date(oneMonthAgo.getTime() + 11*24*60*60*1000), description: "iPhone 14 Pro 128GB Negro Espacial Desbloqueado", category: "iPhone", model: "iPhone 14 Pro", color: "Negro Espacial", capacity: "128GB", grade: "A", condition: "Usado - Like New", serialNumber: "F2LX9K2QM", screenStatus: "Perfecto", batteryHealth: "94%", batteryCycles: 80, qualityPassed: true, purchasePriceUsd: 520, shippingCostUsd: 30, advertisingCostUsd: 8, extraCostsUsd: 5, exchangeRate: 3.70, totalCostPen: 2232.47, taxAmountPen: 405.18, adValoremPen: 76.96, igvPen: 296.68, perceptionPen: 31.54, salePricePen: 3500, saleDate: new Date(oneMonthAgo.getTime() + 16*24*60*60*1000), saleChannel: "WhatsApp", profitPen: 1267.53, profitMargin: 36.22, tenantId: tenant.id },
        { purchaseDate: twoWeeksAgo, orderNumber: "EBAY-2024-004", supplier: "eBay", courier: "UPS", trackingId: "UPS-987654321", shippingStatus: "En Tránsito", estimatedArrival: new Date(twoWeeksAgo.getTime() + 18*24*60*60*1000), description: "iPad Pro 11\" M2 128GB WiFi Color Plata", category: "iPad", model: "iPad Pro 11 M2", color: "Silver", capacity: "128GB", grade: "A", condition: "Usado - Like New", serialNumber: "DMPV9X2KL", purchasePriceUsd: 450, shippingCostUsd: 40, exchangeRate: 3.70, totalCostPen: 2138.49, taxAmountPen: 441.70, adValoremPen: 66.60, igvPen: 331.08, perceptionPen: 44.02, tenantId: tenant.id },
        { purchaseDate: twoWeeksAgo, orderNumber: "EBAY-2024-005", supplier: "eBay", courier: "FedEx", trackingId: "FX-654321789", shippingStatus: "En Tránsito", estimatedArrival: new Date(twoWeeksAgo.getTime() + 20*24*60*60*1000), description: "MacBook Air M2 15\" 8GB/256GB Medianoche", category: "Laptop", model: "MacBook Air 15 M2", color: "Medianoche", capacity: "256GB", grade: "B", condition: "Usado - Good", serialNumber: "FVFH7X9P2Q", purchasePriceUsd: 680, shippingCostUsd: 42, exchangeRate: 3.70, totalCostPen: 3117.90, taxAmountPen: 608.80, adValoremPen: 100.64, igvPen: 456.73, perceptionPen: 51.43, tenantId: tenant.id },
        { purchaseDate: oneWeekAgo, orderNumber: "EBAY-2024-006", supplier: "eBay", shippingStatus: "USA", description: "iPad Mini 6ta Gen 64GB WiFi Color Morado", category: "iPad", model: "iPad Mini 6", color: "Morado", capacity: "64GB", grade: "A", condition: "Nuevo", purchasePriceUsd: 150, shippingCostUsd: 25, exchangeRate: 3.70, totalCostPen: 647.50, tenantId: tenant.id, notes: "FOB <= $200 USD - Sin impuestos" },
        { purchaseDate: oneWeekAgo, orderNumber: "EBAY-2024-007", supplier: "eBay", courier: "FedEx", trackingId: "FX-111222333", shippingStatus: "USA", description: "Apple Watch SE 2da Gen 40mm GPS", category: "Otro", model: "Apple Watch SE 2", color: "Medianoche", capacity: "40mm", grade: "A", condition: "Nuevo", purchasePriceUsd: 120, shippingCostUsd: 18, exchangeRate: 3.70, totalCostPen: 508.40, tenantId: tenant.id, notes: "FOB <= $200 USD - Sin impuestos" },
        { purchaseDate: new Date(now.getTime() - 30*24*60*60*1000), orderNumber: "EBAY-2024-008", supplier: "eBay", courier: "DHL", trackingId: "DHL-444555666", shippingStatus: "Entregado", estimatedArrival: new Date(now.getTime() - 12*24*60*60*1000), actualArrival: new Date(now.getTime() - 10*24*60*60*1000), description: "Samsung Galaxy Tab S9 FE 128GB WiFi", category: "iPad", model: "Galaxy Tab S9 FE", color: "Gris", capacity: "128GB", grade: "B", condition: "Usado - Like New", serialNumber: "R5CT9X2KL7M", screenStatus: "Rayones menores", batteryHealth: "89%", batteryCycles: 200, qualityPassed: true, qualityNotes: "Rayones menores en pantalla", purchasePriceUsd: 180, shippingCostUsd: 28, exchangeRate: 3.70, totalCostPen: 770.40, tenantId: tenant.id, notes: "Entregado, pendiente de venta" },
      ],
    });

    // Get the created products for linking
    const allProducts = await db.product.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } });

    // 7. Create sales
    await db.sale.createMany({
      data: [
        { productId: allProducts[0].id, clientId: client1.id, salePricePen: 2850, costAcquisitionPen: 1788.52, costMarketingPen: 18.50, costOperativePen: 15, netProfitPen: 1027.98, profitMargin: 36.07, saleDate: new Date(threeMonthsAgo.getTime() + 25*24*60*60*1000), saleChannel: "MercadoLibre", paymentMethod: "MercadoPago", warrantyMonths: 3, status: "Completada", deliveryStatus: "Entregado", deliveryDate: new Date(threeMonthsAgo.getTime() + 27*24*60*60*1000), tenantId: tenant.id },
        { productId: allProducts[1].id, clientId: client3.id, salePricePen: 5200, costAcquisitionPen: 3294.28, costMarketingPen: 37.10, costOperativePen: 25, netProfitPen: 1843.62, profitMargin: 35.45, saleDate: new Date(twoMonthsAgo.getTime() + 20*24*60*60*1000), saleChannel: "Tienda", paymentMethod: "Yape", warrantyMonths: 6, status: "Completada", deliveryStatus: "Entregado", deliveryDate: new Date(twoMonthsAgo.getTime() + 21*24*60*60*1000), tenantId: tenant.id },
        { productId: allProducts[2].id, clientId: client2.id, salePricePen: 3500, costAcquisitionPen: 2232.47, costMarketingPen: 29.60, costOperativePen: 20, netProfitPen: 1217.93, profitMargin: 34.80, saleDate: new Date(oneMonthAgo.getTime() + 16*24*60*60*1000), saleChannel: "WhatsApp", paymentMethod: "Yape", warrantyMonths: 3, status: "Completada", deliveryStatus: "Entregado", deliveryDate: new Date(oneMonthAgo.getTime() + 18*24*60*60*1000), tenantId: tenant.id },
      ],
    });

    // 8. Create tracking updates
    await db.trackingUpdate.createMany({
      data: [
        { productId: allProducts[3].id, status: "USA", location: "Miami, FL", description: "Paquete recibido en almacén de origen", timestamp: twoWeeksAgo },
        { productId: allProducts[3].id, status: "En Tránsito", location: "Lima, PE", description: "Paquete en tránsito internacional", timestamp: new Date(twoWeeksAgo.getTime() + 5*24*60*60*1000) },
        { productId: allProducts[3].id, status: "En Tránsito", location: "Aduanas Lima", description: "En proceso de despacho aduanero", timestamp: new Date(twoWeeksAgo.getTime() + 10*24*60*60*1000) },
        { productId: allProducts[4].id, status: "USA", location: "Los Angeles, CA", description: "Paquete despachado por el vendedor", timestamp: twoWeeksAgo },
        { productId: allProducts[4].id, status: "En Tránsito", location: "Panamá", description: "Paquete en tránsito por Panamá", timestamp: new Date(twoWeeksAgo.getTime() + 7*24*60*60*1000) },
      ],
    });

    // 9. Create quality checks
    await db.qualityCheck.createMany({
      data: [
        { productId: allProducts[0].id, screenOk: true, touchscreenOk: true, buttonsOk: true, speakersOk: true, microphoneOk: true, cameraOk: true, portsOk: true, wifiOk: true, bluetoothOk: true, keyboardOk: false, trackpadOk: false, housingOk: true, batteryOk: true, chargerIncluded: true, originalBox: true, passed: true, inspector: "Carlos M.", notes: "Producto en excelente estado" },
        { productId: allProducts[1].id, screenOk: true, touchscreenOk: true, buttonsOk: true, speakersOk: true, microphoneOk: true, cameraOk: true, portsOk: true, wifiOk: true, bluetoothOk: true, keyboardOk: true, trackpadOk: true, housingOk: true, batteryOk: true, chargerIncluded: true, originalBox: false, passed: true, inspector: "Carlos M.", notes: "Sin caja original" },
        { productId: allProducts[2].id, screenOk: true, touchscreenOk: true, buttonsOk: true, speakersOk: true, microphoneOk: true, cameraOk: true, portsOk: true, wifiOk: true, bluetoothOk: true, keyboardOk: false, trackpadOk: false, housingOk: true, batteryOk: true, chargerIncluded: true, originalBox: true, passed: true, inspector: "María L." },
        { productId: allProducts[7].id, screenOk: true, touchscreenOk: true, buttonsOk: true, speakersOk: true, microphoneOk: true, cameraOk: true, portsOk: true, wifiOk: true, bluetoothOk: true, keyboardOk: false, trackpadOk: false, housingOk: true, batteryOk: true, chargerIncluded: true, originalBox: false, passed: true, inspector: "María L.", notes: "Rayones menores en pantalla" },
      ],
    });

    // 10. Create monthly sales records
    const month3Str = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
    const month2Str = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}`;
    const month1Str = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, "0")}`;

    await db.monthlySales.createMany({
      data: [
        { month: month3Str, totalSalesPen: 2850, totalCostPen: 1822.02, category: "Cat 1", alertLevel: "none", notes: "Venta iPad Air", tenantId: tenant.id },
        { month: month2Str, totalSalesPen: 5200, totalCostPen: 3356.38, category: "Cat 2", alertLevel: "none", notes: "Venta MacBook Pro", tenantId: tenant.id },
        { month: month1Str, totalSalesPen: 3500, totalCostPen: 2282.07, category: "Cat 1", alertLevel: "none", notes: "Venta iPhone 14 Pro", tenantId: tenant.id },
      ],
    });

    return NextResponse.json({
      message: "Datos de ejemplo creados exitosamente",
      demoAccounts: {
        tenantAdmin: { email: "admin@importhub.pe", password: "Demo1234" },
        superAdmin: { email: "superadmin@importhub.pe", password: "SuperAdmin123" },
      },
      summary: { products: 8, clients: 5, sales: 3, qualityChecks: 4, trackingUpdates: 5 },
    }, { status: 201 });
  } catch (error) {
    console.error("Error seeding data:", error);
    return NextResponse.json({ error: "Error al crear datos de ejemplo" }, { status: 500 });
  }
}
