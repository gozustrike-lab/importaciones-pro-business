import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/clients/[id] - Get client with sales history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await db.client.findUnique({
      where: { id },
      include: {
        sales: {
          include: { product: true },
          orderBy: { saleDate: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const mappedSales = client.sales.map((s) => ({
      id: s.id,
      saleDate: s.saleDate.toISOString(),
      saleChannel: s.saleChannel,
      productId: s.productId,
      productDescription: s.product.description,
      productModel: s.product.model,
      clientId: s.clientId,
      clientName: client.fullName,
      clientDniRuc: client.dniRuc,
      clientCelular: client.celular,
      salePricePen: s.salePricePen,
      costAcquisitionPen: s.costAcquisitionPen,
      costMarketingPen: s.costMarketingPen,
      costOperativePen: s.costOperativePen,
      netProfitPen: s.netProfitPen,
      profitMargin: s.profitMargin,
      status: s.status,
      paymentMethod: s.paymentMethod,
      warrantyMonths: s.warrantyMonths,
      warrantyNotes: s.warrantyNotes,
      deliveryStatus: s.deliveryStatus,
      deliveryDate: s.deliveryDate?.toISOString() || "",
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({
      id: client.id,
      fullName: client.fullName,
      dniRuc: client.dniRuc,
      celular: client.celular,
      email: client.email,
      ciudad: client.ciudad,
      direccion: client.direccion,
      notas: client.notas,
      isFrequent: client.isFrequent,
      totalPurchases: client.totalPurchases,
      totalSpent: client.totalSpent,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      sales: mappedSales,
    });
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json({ error: "Error al obtener el cliente" }, { status: 500 });
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const client = await db.client.update({
      where: { id },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName }),
        ...(body.dniRuc !== undefined && { dniRuc: body.dniRuc }),
        ...(body.celular !== undefined && { celular: body.celular }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.ciudad !== undefined && { ciudad: body.ciudad }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
        ...(body.notas !== undefined && { notas: body.notas }),
      },
    });

    return NextResponse.json({
      id: client.id,
      fullName: client.fullName,
      dniRuc: client.dniRuc,
      celular: client.celular,
      email: client.email,
      ciudad: client.ciudad,
      direccion: client.direccion,
      notas: client.notas,
      isFrequent: client.isFrequent,
      totalPurchases: client.totalPurchases,
      totalSpent: client.totalSpent,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Error al actualizar el cliente" }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if client has sales
    const salesCount = await db.sale.count({ where: { clientId: id } });
    if (salesCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: el cliente tiene ${salesCount} venta(s) registrada(s)` },
        { status: 400 }
      );
    }

    await db.client.delete({ where: { id } });
    return NextResponse.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json({ error: "Error al eliminar el cliente" }, { status: 500 });
  }
}
