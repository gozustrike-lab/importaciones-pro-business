import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { scanLiveEbayDealsForQuery } from "@/lib/ebay";

// POST /api/deal-trackers/scan-all - Scan all active models in real time on eBay (Seller >= 95%, sorted lowest-to-highest price)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const trackers = await db.dealTracker.findMany({
      where: { tenantId: currentUser.tenantId, isActive: true },
      include: { supplier: true },
    });

    if (trackers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay modelos en la mira configurados.",
        newDealsCount: 0,
      });
    }

    let totalFound = 0;

    for (const tracker of trackers) {
      const liveDeals = await scanLiveEbayDealsForQuery({
        keywords: tracker.keywords || tracker.title,
        sellerUsername: tracker.sellerUsername,
        maxPriceUsd: tracker.maxPriceUsd,
        minFeedbackPct: 95.0,
        limit: 8,
      });

      if (liveDeals.length > 0) {
        // Remove unstarred previous results for this tracker so we always show fresh lowest-price live listings
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

        await db.dealTracker.update({
          where: { id: tracker.id },
          data: {
            lastCheckedAt: new Date(),
            lastFoundCount: liveDeals.length,
          },
        });

        totalFound += liveDeals.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `¡Tracking en vivo actualizado! ${totalFound} productos reales de eBay (vendedores ≥95%) ordenados de menor a mayor precio.`,
      newDealsCount: totalFound,
    });
  } catch (error: any) {
    console.error("Error scanning all deals:", error);
    return NextResponse.json(
      { error: error.message || "Error al escanear ofertas en eBay" },
      { status: 500 }
    );
  }
}
