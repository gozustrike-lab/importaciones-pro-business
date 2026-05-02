import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// POST /api/suppliers/[id]/sync - Trigger sync (placeholder)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);
    const { id } = await params;

    const supplier = await db.supplier.findFirst({
      where: { id, ...tenantFilter },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    // Mark lastSyncAt
    await db.supplier.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      message: "Sincronización iniciada correctamente",
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error syncing supplier:", error);
    const message = error instanceof Error ? error.message : "Error al sincronizar el proveedor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
