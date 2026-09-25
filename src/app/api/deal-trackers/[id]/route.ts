import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { parseEbaySeller } from "../route";

// PUT /api/deal-trackers/[id] - Update deal tracker
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.dealTracker.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Buscador no encontrado" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.keywords !== undefined) updateData.keywords = body.keywords.trim();
    if (body.category !== undefined) updateData.category = body.category;
    if (body.condition !== undefined) updateData.condition = body.condition;
    if (body.maxPriceUsd !== undefined) updateData.maxPriceUsd = body.maxPriceUsd ? parseFloat(body.maxPriceUsd) : null;
    if (body.minDiscountPct !== undefined) updateData.minDiscountPct = parseFloat(body.minDiscountPct) || 0;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.notificationsEnabled !== undefined) updateData.notificationsEnabled = Boolean(body.notificationsEnabled);

    if (body.sellerLink !== undefined) {
      const parsed = parseEbaySeller(body.sellerLink);
      updateData.sellerUsername = parsed.sellerUsername || null;
      updateData.storeUrl = parsed.storeUrl || null;
    } else {
      if (body.sellerUsername !== undefined) updateData.sellerUsername = body.sellerUsername;
      if (body.storeUrl !== undefined) updateData.storeUrl = body.storeUrl;
    }

    const updated = await db.dealTracker.update({
      where: { id },
      data: updateData,
      include: { supplier: true, deals: true },
    });

    return NextResponse.json({ success: true, tracker: updated });
  } catch (error: any) {
    console.error("Error updating deal tracker:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el buscador" },
      { status: 500 }
    );
  }
}

// DELETE /api/deal-trackers/[id] - Delete deal tracker
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.dealTracker.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Buscador no encontrado" }, { status: 404 });
    }

    await db.dealTracker.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting deal tracker:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el buscador" },
      { status: 500 }
    );
  }
}
