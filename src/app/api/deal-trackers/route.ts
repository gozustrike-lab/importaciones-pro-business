import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";

// Helper to extract seller username and clean store URL from an eBay link
export function parseEbaySeller(input?: string): { sellerUsername?: string; storeUrl?: string } {
  if (!input || !input.trim()) return {};
  const str = input.trim();

  // If it's a URL
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

  // Raw username (e.g. "itsworthmore" or "@itsworthmore")
  const cleanUser = str.replace(/^@/, "").trim();
  return {
    sellerUsername: cleanUser,
    storeUrl: `https://www.ebay.com/str/${cleanUser}`,
  };
}

// GET /api/deal-trackers - List all deal trackers & recent deals
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
          orderBy: { foundAt: "desc" },
          take: 20,
        },
      },
    });

    // Also get total unread alerts
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

// POST /api/deal-trackers - Create new deal tracker
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
    }

    const body = await request.json();
    const { title, keywords, sellerLink, maxPriceUsd, minDiscountPct, condition, category, supplierId } = body;

    if (!title || !keywords) {
      return NextResponse.json(
        { error: "El título y las palabras clave de búsqueda son requeridos" },
        { status: 400 }
      );
    }

    const parsed = parseEbaySeller(sellerLink);
    const sellerUsername = body.sellerUsername || parsed.sellerUsername || null;
    const storeUrl = body.storeUrl || parsed.storeUrl || (sellerUsername ? `https://www.ebay.com/str/${sellerUsername}` : null);

    const tracker = await db.dealTracker.create({
      data: {
        title: title.trim(),
        keywords: keywords.trim(),
        sellerUsername,
        storeUrl,
        supplierId: supplierId || null,
        category: category || "Tablets",
        maxPriceUsd: maxPriceUsd ? parseFloat(maxPriceUsd) : null,
        minDiscountPct: minDiscountPct ? parseFloat(minDiscountPct) : 10,
        condition: condition || "Used",
        isActive: true,
        notificationsEnabled: true,
        tenantId: currentUser.tenantId,
        lastCheckedAt: new Date(),
        lastFoundCount: 0,
      },
      include: {
        supplier: true,
        deals: true,
      },
    });

    return NextResponse.json({
      success: true,
      tracker,
    });
  } catch (error: any) {
    console.error("Error creating deal tracker:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el buscador de ofertas" },
      { status: 500 }
    );
  }
}
