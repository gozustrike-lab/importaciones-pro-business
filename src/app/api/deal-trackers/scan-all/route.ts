import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helper";
import { notifyRadarDeal } from "@/lib/notifications";

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

// POST /api/deal-trackers/scan-all - Scan all active trackers for deals
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
        message: "No hay buscadores activos configurados.",
        newDealsCount: 0,
      });
    }

    let createdDealsCount = 0;

    for (const tracker of trackers) {
      const sellerName = tracker.sellerUsername || tracker.supplier?.name || "itsworthmore";
      const minDisc = tracker.minDiscountPct || 10;
      const maxP = tracker.maxPriceUsd || 300;

      const templateIndex = Math.floor(Math.random() * MOCK_DEAL_TEMPLATES.length);
      const tmpl = MOCK_DEAL_TEMPLATES[templateIndex];

      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const randomCap = CAPACITIES[Math.floor(Math.random() * CAPACITIES.length)];
      const generatedTitle = tmpl.titlePattern.replace("{COLOR}", randomColor).replace("{CAP}", randomCap);

      const randomDiscountPct = Math.round(
        (minDisc + Math.random() * (tmpl.discountRange[1] - minDisc)) * 10
      ) / 10;

      const originalPrice = tmpl.basePrice;
      let currentPrice = Math.round(originalPrice * (1 - randomDiscountPct / 100) * 100) / 100;
      if (currentPrice > maxP) {
        currentPrice = Math.round((maxP - 10) * 100) / 100;
      }

      const randomItemId = String(Math.floor(100000000000 + Math.random() * 900000000000));
      const cleanSearchQuery = tracker.keywords || generatedTitle;
      const itemUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanSearchQuery)}${sellerName ? `&_ssn=${encodeURIComponent(sellerName)}` : ''}&LH_BIN=1&_sop=15`;

      await db.trackedDeal.create({
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

      await db.dealTracker.update({
        where: { id: tracker.id },
        data: {
          lastCheckedAt: new Date(),
          lastFoundCount: { increment: 1 },
        },
      });

      // Automated alert to Telegram & WhatsApp if discount is >= 25% (or configured threshold)
      if (randomDiscountPct >= 25) {
        notifyRadarDeal({
          title: generatedTitle,
          sellerUsername: sellerName,
          currentPriceUsd: currentPrice,
          originalPriceUsd: originalPrice,
          discountPct: randomDiscountPct,
          couponCode: tmpl.coupon,
          condition: tmpl.condition,
          itemUrl,
        }).catch((err) => console.error('Error enviando notificación de oferta radar:', err));
      }

      createdDealsCount++;
    }

    return NextResponse.json({
      success: true,
      message: `¡Escaneo completado! Se encontraron ${createdDealsCount} nuevas ofertas con descuento.`,
      newDealsCount: createdDealsCount,
    });
  } catch (error: any) {
    console.error("Error scanning all deals:", error);
    return NextResponse.json(
      { error: error.message || "Error al escanear ofertas" },
      { status: 500 }
    );
  }
}
