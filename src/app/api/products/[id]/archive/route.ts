import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// PATCH /api/products/[id]/archive
// Body: { isArchived: boolean }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const body = await request.json();
    const isArchived = Boolean(body.isArchived);

    // Verify product belongs to tenant
    const existing = await db.product.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const updated = await db.product.update({
      where: { id },
      data: { isArchived },
    });

    return NextResponse.json({
      id: updated.id,
      isArchived: updated.isArchived,
      description: updated.description,
    });
  } catch (error: unknown) {
    console.error("Error toggling archive status:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
