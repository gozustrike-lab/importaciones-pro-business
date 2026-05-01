import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// GET /api/sales - List sales (tenant-scoped)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const clientId = searchParams.get("clientId") || "";
    const month = searchParams.get("month") || "";

    const where: Record<string, unknown> = { ...tenantFilter };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (month) {
      where.saleDate = {
        gte: new Date(`${month}-01T00:00:00.000Z`),
        lt: new Date(`${month}-31T23:59:59.999Z`),
      };
    }

    const sales = await db.sale.findMany({
      where, include: { product: true, client: true },
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json(sales.map((s) => ({
      id: s.id, saleDate: s.saleDate.toISOString(), saleChannel: s.saleChannel,
      productId: s.productId, productDescription: s.product.description,
      productModel: s.product.model, clientId: s.clientId,
      clientName: s.client.fullName, clientDniRuc: s.client.dniRuc,
      clientCelular: s.client.celular, salePricePen: s.salePricePen,
      costAcquisitionPen: s.costAcquisitionPen, costMarketingPen: s.costMarketingPen,
      costOperativePen: s.costOperativePen, netProfitPen: s.netProfitPen,
      profitMargin: s.profitMargin, status: s.status,
      paymentMethod: s.paymentMethod, warrantyMonths: s.warrantyMonths,
      warrantyNotes: s.warrantyNotes, deliveryStatus: s.deliveryStatus,
      deliveryDate: s.deliveryDate?.toISOString() || "", createdAt: s.createdAt.toISOString(),
    })));
  } catch (error: unknown) {
    console.error("Error fetching sales:", error);
    const message = error instanceof Error ? error.message : "Error al obtener las ventas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sales - Register sale (tenant-scoped)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      productId, clientId, salePricePen, costMarketingPen, costOperativePen,
      saleChannel, paymentMethod, warrantyMonths, warrantyNotes,
    } = body;

    if (!productId || !clientId || !salePricePen) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: productId, clientId, salePricePen" },
        { status: 400 }
      );
    }

    const product = await db.product.findFirst({
      where: { id: productId, tenantId: currentUser.tenantId },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const client = await db.client.findFirst({
      where: { id: clientId, tenantId: currentUser.tenantId },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const costAcquisitionPen = product.totalCostPen;
    const marketing = costMarketingPen || 0;
    const operative = costOperativePen || 0;
    const totalCosts = costAcquisitionPen + marketing + operative;
    const netProfit = salePricePen - totalCosts;
    const margin = salePricePen > 0 ? (netProfit / salePricePen) * 100 : 0;

    const sale = await db.sale.create({
      data: {
        productId, clientId, salePricePen, costAcquisitionPen,
        costMarketingPen: marketing, costOperativePen: operative,
        netProfitPen: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(margin * 100) / 100,
        saleChannel: saleChannel || "", paymentMethod: paymentMethod || "",
        warrantyMonths: warrantyMonths || 3, warrantyNotes: warrantyNotes || "",
        status: "Completada", deliveryStatus: "Pendiente",
        tenantId: currentUser.tenantId,
      },
    });

    await db.product.update({
      where: { id: productId },
      data: {
        shippingStatus: "Vendido", salePricePen,
        saleDate: sale.saleDate, saleChannel: saleChannel || "",
        profitPen: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(margin * 100) / 100,
      },
    });

    const newPurchaseCount = client.totalPurchases + 1;
    const newTotalSpent = client.totalSpent + salePricePen;
    await db.client.update({
      where: { id: clientId },
      data: { totalPurchases: newPurchaseCount, totalSpent: newTotalSpent, isFrequent: newPurchaseCount >= 3 },
    });

    const currentMonth = `${sale.saleDate.getFullYear()}-${String(sale.saleDate.getMonth() + 1).padStart(2, "0")}`;
    const existingMonth = await db.monthlySales.findFirst({
      where: { month: currentMonth, tenantId: currentUser.tenantId },
    });

    if (existingMonth) {
      await db.monthlySales.update({
        where: { id: existingMonth.id },
        data: { totalSalesPen: existingMonth.totalSalesPen + salePricePen, totalCostPen: existingMonth.totalCostPen + totalCosts },
      });
    } else {
      await db.monthlySales.create({
        data: {
          month: currentMonth, totalSalesPen: salePricePen, totalCostPen: totalCosts,
          category: "Cat 1", alertLevel: "none", tenantId: currentUser.tenantId,
        },
      });
    }

    return NextResponse.json({
      id: sale.id, saleDate: sale.saleDate.toISOString(), saleChannel: sale.saleChannel,
      productId: sale.productId, productDescription: product.description,
      productModel: product.model, clientId: sale.clientId,
      clientName: client.fullName, clientDniRuc: client.dniRuc,
      clientCelular: client.celular, salePricePen: sale.salePricePen,
      costAcquisitionPen: sale.costAcquisitionPen, costMarketingPen: sale.costMarketingPen,
      costOperativePen: sale.costOperativePen, netProfitPen: sale.netProfitPen,
      profitMargin: sale.profitMargin, status: sale.status,
      paymentMethod: sale.paymentMethod, warrantyMonths: sale.warrantyMonths,
      warrantyNotes: sale.warrantyNotes, deliveryStatus: sale.deliveryStatus,
      deliveryDate: sale.deliveryDate?.toISOString() || "", createdAt: sale.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating sale:", error);
    const message = error instanceof Error ? error.message : "Error al registrar la venta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
