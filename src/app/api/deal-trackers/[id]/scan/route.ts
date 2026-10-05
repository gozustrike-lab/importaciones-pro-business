import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { scanLiveEbayDealsForQuery } from "@/lib/ebay";

// POST /api/deal-trackers/[id]/scan - Scan live eBay for a specific tracked model (Seller >= 95%, sorted lowest-to-highest price)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const tracker = await db.dealTracker.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!tracker || tracker.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
    }

    const liveDeals = await scanLiveEbayDealsForQuery({
      keywords: tracker.keywords || tracker.title,
      sellerUsername: tracker.sellerUsername,
      maxPriceUsd: tracker.maxPriceUsd,
      minFeedbackPct: 95.0,
      limit: 10,
    });

    if (liveDeals.length > 0) {
      await db.trackedDeal.deleteMany({
        where: {
          trackerId: tracker.id,
          isStarred: false,
        },
      });

      await db.trackedDeal.createMany({
        data: liveDeals.map((d) => ({
          trackerId: tracker.id,
          itemId: d.itemId,
          title: d.title,
          itemUrl: d.itemUrl,
          imageUrl: d.imageUrl,
          sellerUsername: d.sellerUsername,
          sellerFeedback: d.sellerFeedback,
          currentPriceUsd: d.currentPriceUsd,
          originalPriceUsd: d.originalPriceUsd,
          discountPct: d.discountPct,
          couponCode: null,
          promoDescription: d.promoDescription,
          condition: d.condition,
          isRead: false,
          isStarred: false,
          foundAt: new Date(),
        })),
      });
    }

    const updatedTracker = await db.dealTracker.update({
      where: { id: tracker.id },
      data: {
        lastCheckedAt: new Date(),
        lastFoundCount: liveDeals.length,
      },
      include: {
        deals: { orderBy: { currentPriceUsd: "asc" }, take: 25 },
        supplier: true,
      },
    });

    const bestPrice = liveDeals[0]?.currentPriceUsd;

    return NextResponse.json({
      success: true,
      message: bestPrice
        ? `¡${liveDeals.length} equipos reales encontrados desde $${bestPrice.toFixed(2)} USD (vendedores ≥95%)!`
        : "Escaneo completado.",
      tracker: updatedTracker,
    });
  } catch (error: any) {
    console.error("Error scanning deals:", error);
    return NextResponse.json(
      { error: error.message || "Error al escanear modelo en eBay" },
      { status: 500 }
    );
  }
}
