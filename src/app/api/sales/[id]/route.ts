import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/sales/[id] - Update delivery status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { deliveryStatus, deliveryDate } = body;

    const sale = await db.sale.update({
      where: { id },
      data: {
        ...(deliveryStatus && { deliveryStatus }),
        ...(deliveryDate && { deliveryDate: new Date(deliveryDate) }),
        ...(deliveryStatus === 'Entregado' && !deliveryDate && { deliveryDate: new Date() }),
      },
    });

    return NextResponse.json({
      id: sale.id,
      deliveryStatus: sale.deliveryStatus,
      deliveryDate: sale.deliveryDate?.toISOString() || "",
    });
  } catch (error) {
    console.error("Error updating sale:", error);
    return NextResponse.json({ error: "Error al actualizar la venta" }, { status: 500 });
  }
}
