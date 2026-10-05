import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { scanLiveEbayDealsForQuery } from "@/lib/ebay";

// Helper to extract seller username and clean store URL from an eBay link
export function parseEbaySeller(input?: string): { sellerUsername?: string; storeUrl?: string } {
  if (!input || !input.trim()) return {};
  const str = input.trim();

  if (str.startsWith("http://") || str.startsWith("https://")) {
    const storeMatch = str.match(/ebay\.com\/str\/([a-zA-Z0-9._-]+)/i);
    if (storeMatch) {
      const seller = storeMatch[1];
      return { sellerUsername: seller, storeUrl: `https://www.ebay.com/str/${seller}` };
    }
    const usrMatch = str.match(/ebay\.com\/usr\/([a-zA-Z0-9._-]+)/i);
    if (usrMatch) {
      const seller = usrMatch[1];
      return { sellerUsername: seller, storeUrl: `https://www.ebay.com/str/${seller}` };
    }
    const ssnMatch = str.match(/_ssn=([a-zA-Z0-9._-]+)/i);
    if (ssnMatch) {
      const seller = ssnMatch[1];
      return { sellerUsername: seller, storeUrl: `https://www.ebay.com/str/${seller}` };
    }
    return { storeUrl: str };
  }

  const cleanUser = str.replace(/^@/, "").trim();
  if (cleanUser.toLowerCase() === "all") return {};
  return {
    sellerUsername: cleanUser,
    storeUrl: `https://www.ebay.com/str/${cleanUser}`,
  };
}

// GET /api/deal-trackers - List all deal trackers & live deals sorted lowest-to-highest price
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    const trackers = await db.dealTracker.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: {
          select: { id: true, name: true, url: true, rating: true, totalOrders: true },
        },
        deals: {
          orderBy: { currentPriceUsd: "asc" },
          take: 25,
        },
      },
    });

    const allDeals = trackers.flatMap((t) => t.deals);
    const unreadCount = allDeals.filter((d) => !d.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      totalTrackers: trackers.length,
      trackers,
    });
  } catch (error: any) {
    console.error("Error fetching deal trackers:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener los buscadores de ofertas" },
      { status: 500 }
    );
  }
}

// POST /api/deal-trackers - Create new deal tracker & immediately scan eBay live (Seller >= 95%, sorted by lowest price)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    const { title, keywords, sellerLink, maxPriceUsd, minDiscountPct, condition, category, supplierId } = body;

    const cleanKeywords = (keywords || title || "").trim();
    const cleanTitle = (title || cleanKeywords).trim();

    if (!cleanKeywords) {
      return NextResponse.json(
        { error: "Indica el modelo o palabras clave del producto a rastrear" },
        { status: 400 }
      );
    }

    const parsed = parseEbaySeller(sellerLink || body.sellerUsername);
    const sellerUsername = parsed.sellerUsername || null;
    const storeUrl = parsed.storeUrl || (sellerUsername ? `https://www.ebay.com/str/${sellerUsername}` : null);
    const parsedMaxPrice = maxPriceUsd ? parseFloat(maxPriceUsd) : null;

    const tracker = await db.dealTracker.create({
      data: {
        title: cleanTitle,
        keywords: cleanKeywords,
        sellerUsername,
        storeUrl,
        supplierId: supplierId || null,
        category: category || "Tablets",
        maxPriceUsd: parsedMaxPrice,
        minDiscountPct: minDiscountPct ? parseFloat(minDiscountPct) : 15,
        condition: condition || "Used",
        isActive: true,
        notificationsEnabled: true,
        tenantId: currentUser.tenantId,
        lastCheckedAt: new Date(),
        lastFoundCount: 0,
      },
    });

    // Immediately scan live eBay for this model (Seller >= 95%, sorted by lowest price)
    const liveDeals = await scanLiveEbayDealsForQuery({
      keywords: cleanKeywords,
      sellerUsername,
      maxPriceUsd: parsedMaxPrice,
      minFeedbackPct: 95.0,
      limit: 8,
    });

    if (liveDeals.length > 0) {
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
        data: { lastFoundCount: liveDeals.length },
      });
    }

    const fullTracker = await db.dealTracker.findUnique({
      where: { id: tracker.id },
      include: {
        supplier: true,
        deals: { orderBy: { currentPriceUsd: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      tracker: fullTracker,
      foundCount: liveDeals.length,
    });
  } catch (error: any) {
    console.error("Error creating deal tracker:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el buscador de ofertas" },
      { status: 500 }
    );
  }
}
