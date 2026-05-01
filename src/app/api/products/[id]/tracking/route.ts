import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/products/[id]/tracking - Get all tracking updates for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const trackingUpdates = await db.trackingUpdate.findMany({
      where: { productId: id },
      orderBy: { timestamp: "desc" },
    });

    // Map to frontend format (DB field: timestamp -> frontend: date)
    const mapped = trackingUpdates.map((t) => ({
      id: t.id,
      date: t.timestamp.toISOString(),
      location: t.location,
      status: t.status,
      description: t.description,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching tracking updates:", error);
    return NextResponse.json(
      { error: "Error al obtener las actualizaciones de seguimiento" },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/tracking - Add new tracking update
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Verify product exists
    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const { status, location, description, date } = body;

    if (!status) {
      return NextResponse.json(
        { error: "El campo 'status' es obligatorio" },
        { status: 400 }
      );
    }

    // Create tracking update
    const trackingUpdate = await db.trackingUpdate.create({
      data: {
        productId: id,
        status,
        location: location || "",
        description: description || "",
        timestamp: date ? new Date(date) : new Date(),
      },
    });

    // Update product's shipping status
    const validStatuses = ["USA", "En Tránsito", "Perú", "Entregado"];
    if (validStatuses.includes(status)) {
      await db.product.update({
        where: { id },
        data: { shippingStatus: status },
      });
    }

    // If status is "Entregado" and product has no actualArrival, set it
    if (status === "Entregado" && !product.actualArrival) {
      await db.product.update({
        where: { id },
        data: { actualArrival: new Date() },
      });
    }

    // Return in frontend format
    return NextResponse.json({
      id: trackingUpdate.id,
      date: trackingUpdate.timestamp.toISOString(),
      location: trackingUpdate.location,
      status: trackingUpdate.status,
      description: trackingUpdate.description,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating tracking update:", error);
    return NextResponse.json(
      { error: "Error al crear la actualización de seguimiento" },
      { status: 500 }
    );
  }
}
