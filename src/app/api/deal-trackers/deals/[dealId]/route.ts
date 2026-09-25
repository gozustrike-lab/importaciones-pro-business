import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { sanitizeSunatModel } from "@/lib/shipper-classification";

// PUT /api/deal-trackers/deals/[dealId] - Update deal (read, star, purchase)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { dealId } = await params;
    const body = await request.json();

    const deal = await db.trackedDeal.findUnique({
      where: { id: dealId },
      include: { tracker: true },
    });

    if (!deal || deal.tracker.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (body.isRead !== undefined) updateData.isRead = Boolean(body.isRead);
    if (body.isStarred !== undefined) updateData.isStarred = Boolean(body.isStarred);

    const updated = await db.trackedDeal.update({
      where: { id: dealId },
      data: updateData,
    });

    return NextResponse.json({ success: true, deal: updated });
  } catch (error: any) {
    console.error("Error updating deal:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la oferta" },
      { status: 500 }
    );
  }
}

// POST /api/deal-trackers/deals/[dealId] - 1-Click Import Deal to Product Inventory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { dealId } = await params;

    const deal = await db.trackedDeal.findUnique({
      where: { id: dealId },
      include: { tracker: true },
    });

    if (!deal || deal.tracker.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    }

    const cleanModel = sanitizeSunatModel(deal.title);
    const purchaseUsd = deal.currentPriceUsd;
    const shippingUsd = 0;
    const exchangeRate = 3.40;
    const totalCostPen = (purchaseUsd + shippingUsd) * exchangeRate;
    const suggestedPricePen = Math.round(totalCostPen * 1.35); // 35% margin markup

    const orderNumber = `EBAY-${deal.itemId.slice(-6)}-${Date.now().toString().slice(-4)}`;

    const newProduct = await db.product.create({
      data: {
        orderNumber,
        description: deal.title,
        model: cleanModel,
        condition: deal.condition,
        supplier: deal.sellerUsername,
        courier: "USPS",
        trackingId: "",
        shipperConfirmed: false,
        shippingStatus: "TRANSITO_USA",
        purchaseDate: new Date(),
        purchasePriceUsd: purchaseUsd,
        shippingCostUsd: shippingUsd,
        exchangeRate,
        totalCostPen,
        suggestedPricePen,
        salePricePen: 0,
        notes: `Importado directamente desde Radar de Ofertas eBay (ItemID: ${deal.itemId}, Descuento: ${deal.discountPct || 0}%).`,
        importerProfile: "fabio",
        tenantId: currentUser.tenantId,
      },
    });

    // Mark deal as read
    await db.trackedDeal.update({
      where: { id: dealId },
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      message: `¡Producto registrado en el inventario como ${orderNumber}!`,
      product: newProduct,
    });
  } catch (error: any) {
    console.error("Error importing deal to product:", error);
    return NextResponse.json(
      { error: error.message || "Error al importar oferta a compras" },
      { status: 500 }
    );
  }
}

// DELETE /api/deal-trackers/deals/[dealId] - Dismiss deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await db.trackedDeal.findUnique({
      where: { id: dealId },
      include: { tracker: true },
    });

    if (!deal || deal.tracker.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Oferta no encontrada" }, { status: 404 });
    }

    await db.trackedDeal.delete({
      where: { id: dealId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting deal:", error);
    return NextResponse.json(
      { error: error.message || "Error al descartar oferta" },
      { status: 500 }
    );
  }
}
