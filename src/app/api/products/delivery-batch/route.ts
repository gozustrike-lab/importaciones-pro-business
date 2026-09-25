import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// Handle preflight OPTIONS for bookmarklet calls from external pages
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// POST /api/products/delivery-batch
// Body: { productIds?: string[], orderNumbers?: string[], arrivalDate?: string }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const body = await request.json();
    const productIds: string[] = body.productIds || [];
    const orderNumbers: string[] = (body.orderNumbers || []).map((o: string) => o.trim()).filter(Boolean);
    const arrivalDate = body.arrivalDate ? new Date(body.arrivalDate) : new Date();

    if (productIds.length === 0 && orderNumbers.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar productIds o orderNumbers" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Build query conditions
    const whereConditions: any[] = [];
    if (productIds.length > 0) {
      whereConditions.push({ id: { in: productIds } });
    }
    if (orderNumbers.length > 0) {
      whereConditions.push({
        OR: orderNumbers.map((ord) => ({
          orderNumber: { contains: ord },
        })),
      });
    }

    // Find matching products that are NOT already in Lima / sold
    const matchingProducts = await db.product.findMany({
      where: {
        AND: [
          tenantFilter,
          { OR: whereConditions },
        ],
      },
      select: { id: true, orderNumber: true, description: true, shippingStatus: true },
    });

    if (matchingProducts.length === 0) {
      return NextResponse.json(
        {
          success: true,
          updatedCount: 0,
          matchedOrders: [],
          message: "No se encontraron productos coincidentes en el inventario",
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Filter to only update items that can transition to USA (avoid regressing Perú / Vendido)
    const eligibleToUpdate = matchingProducts.filter(
      (p) => !["Perú", "Entregado", "Vendido"].includes(p.shippingStatus)
    );

    const idsToUpdate = eligibleToUpdate.map((p) => p.id);
    const updateResult = await db.product.updateMany({
      where: { id: { in: idsToUpdate } },
      data: {
        shippingStatus: "USA",
        actualArrival: arrivalDate,
      },
    });

    return NextResponse.json(
      {
        success: true,
        updatedCount: updateResult.count,
        matchedOrders: eligibleToUpdate.map((p) => p.orderNumber),
        arrivalDate: arrivalDate.toISOString(),
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: unknown) {
    console.error("Error in delivery-batch:", error);
    const message = error instanceof Error ? error.message : "Error al procesar lote de entrega";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
