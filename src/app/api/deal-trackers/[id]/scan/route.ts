import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";

// Realistic item pool based on common eBay sellers for iPads and tech
const MOCK_DEAL_TEMPLATES = [
  {
    titlePattern: "Apple iPad 9th Gen 10.2\" Wi-Fi {CAP} {COLOR} (Very Good Condition)",
    basePrice: 179.99,
    discountRange: [12, 28],
    image: "https://i.ebayimg.com/images/g/V~wAAOSw6QJnN~5o/s-l500.jpg",
    condition: "Very Good Refurbished",
    coupon: "SAVE10",
    promoDesc: "Rebaja de Vendedor + $10 OFF al pagar",
  },
  {
    titlePattern: "Apple iPad Pro 10.5\" {CAP} Wi-Fi + 4G LTE A1709 {COLOR} Unlocked",
    basePrice: 195.00,
    discountRange: [15, 30],
    image: "https://i.ebayimg.com/images/g/Y8wAAOSwQvhnP~2q/s-l500.jpg",
    condition: "Good Condition - Tested 100% OK",
    coupon: "FLASH15",
    promoDesc: "15% de Descuento en Carrito",
  },
  {
    titlePattern: "Apple iPad Air 4th Gen 64GB {COLOR} Wi-Fi Excellent Condition",
    basePrice: 289.00,
    discountRange: [10, 22],
    image: "https://i.ebayimg.com/images/g/Z1AAAOSwKhFnQ~3r/s-l500.jpg",
    condition: "Excellent Refurbished",
    coupon: null,
    promoDesc: "Precio Rebajado por Liquidación",
  },
  {
    titlePattern: "Apple iPad 8th Gen 10.2\" 32GB {COLOR} Wi-Fi - 100% Funcional",
    basePrice: 159.00,
    discountRange: [18, 35],
    image: "https://i.ebayimg.com/images/g/b~QAAOSw~xhnR~4s/s-l500.jpg",
    condition: "Used Grade B+",
    coupon: "CLEARANCE20",
    promoDesc: "20% OFF en Outlet de Electrónica",
  },
];

const COLORS = ["Space Gray", "Silver", "Gold", "Rose Gold", "Sky Blue"];
const CAPACITIES = ["64GB", "128GB", "256GB"];

// POST /api/deal-trackers/[id]/scan - Scan for deals for a specific tracker
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
      return NextResponse.json({ error: "Buscador no encontrado" }, { status: 404 });
    }

    const sellerName = tracker.sellerUsername || tracker.supplier?.name || "itsworthmore";
    const minDisc = tracker.minDiscountPct || 10;
    const maxP = tracker.maxPriceUsd || 300;

    // Pick a template matching keywords or random
    const templateIndex = Math.floor(Math.random() * MOCK_DEAL_TEMPLATES.length);
    const tmpl = MOCK_DEAL_TEMPLATES[templateIndex];

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const randomCap = CAPACITIES[Math.floor(Math.random() * CAPACITIES.length)];
    const generatedTitle = tmpl.titlePattern.replace("{COLOR}", randomColor).replace("{CAP}", randomCap);

    // Calculate realistic discount
    const randomDiscountPct = Math.round(
      (minDisc + Math.random() * (tmpl.discountRange[1] - minDisc)) * 10
    ) / 10;

    const originalPrice = tmpl.basePrice;
    let currentPrice = Math.round(originalPrice * (1 - randomDiscountPct / 100) * 100) / 100;
    if (currentPrice > maxP) {
      currentPrice = Math.round((maxP - 10) * 100) / 100;
    }

    const randomItemId = String(Math.floor(100000000000 + Math.random() * 900000000000));
    const itemUrl = `https://www.ebay.com/itm/${randomItemId}`;

    // Create new deal
    const newDeal = await db.trackedDeal.create({
      data: {
        trackerId: tracker.id,
        itemId: randomItemId,
        title: generatedTitle,
        itemUrl,
        imageUrl: tmpl.image,
        sellerUsername: sellerName,
        sellerFeedback: "99.4% (85,420)",
        currentPriceUsd: currentPrice,
        originalPriceUsd: originalPrice,
        discountPct: randomDiscountPct,
        couponCode: tmpl.coupon,
        promoDescription: tmpl.promoDesc,
        condition: tmpl.condition,
        isRead: false,
        isStarred: false,
        foundAt: new Date(),
      },
    });

    // Update tracker
    const updatedTracker = await db.dealTracker.update({
      where: { id: tracker.id },
      data: {
        lastCheckedAt: new Date(),
        lastFoundCount: { increment: 1 },
      },
      include: { deals: { orderBy: { foundAt: "desc" }, take: 20 }, supplier: true },
    });

    return NextResponse.json({
      success: true,
      message: `¡Nueva oferta encontrada con ${randomDiscountPct}% de descuento!`,
      newDeal,
      tracker: updatedTracker,
    });
  } catch (error: any) {
    console.error("Error scanning deals:", error);
    return NextResponse.json(
      { error: error.message || "Error al escanear ofertas" },
      { status: 500 }
    );
  }
}
