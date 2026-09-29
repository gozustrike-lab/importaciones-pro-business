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

// POST /api/products/archive-batch
// Body: { productIds?: string[], orderNumbers?: string[], isArchived?: boolean }
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const body = await request.json();
    const isArchived = body.isArchived !== undefined ? Boolean(body.isArchived) : true;
    const productIds: string[] = body.productIds || [];
    const orderNumbers: string[] = (body.orderNumbers || []).map((o: string) => o.trim()).filter(Boolean);

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

    // Find matching products
    const matchingProducts = await db.product.findMany({
      where: {
        AND: [
          tenantFilter,
          { OR: whereConditions },
        ],
      },
      select: { id: true, orderNumber: true, description: true, isArchived: true },
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

    const idsMatched = matchingProducts.map((p) => p.id);

    // Mirror mode: Keep ONLY matching products as Active, archive everything else!
    if (body.keepOnlyActive === true) {
      const [unarchivedRes, archivedRes] = await Promise.all([
        db.product.updateMany({
          where: { id: { in: idsMatched } },
          data: { isArchived: false, archivedAt: null },
        }),
        db.product.updateMany({
          where: {
            ...tenantFilter,
            id: { notIn: idsMatched },
            isArchived: false,
          },
          data: { isArchived: true, archivedAt: new Date() },
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          keepOnlyActive: true,
          activeKeptCount: unarchivedRes.count,
          archivedCount: archivedRes.count,
          updatedCount: archivedRes.count,
          matchedOrders: matchingProducts.map((p) => p.orderNumber),
        },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const updateResult = await db.product.updateMany({
      where: { id: { in: idsMatched } },
      data: {
        isArchived,
        archivedAt: isArchived ? new Date() : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        updatedCount: updateResult.count,
        matchedOrders: matchingProducts.map((p) => p.orderNumber),
        isArchived,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: unknown) {
    console.error("Error in archive-batch:", error);
    const message = error instanceof Error ? error.message : "Error al procesar lote";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
