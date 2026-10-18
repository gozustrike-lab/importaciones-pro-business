import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, getTenantFilter } from "@/lib/auth-helper";
import { getProductCatalogInfo } from "@/lib/catalog-helper";

// GET /api/catalog/export-whatsapp - Export active inventory to WhatsApp Business / Meta Catalog CSV format
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const tenantFilter = getTenantFilter(currentUser);

    let products = await db.product.findMany({
      where: {
        ...tenantFilter,
        isArchived: false,
      },
      orderBy: { purchaseDate: "desc" },
    });

    // Public / Meta crawler fallback
    if (products.length === 0) {
      products = await db.product.findMany({
        where: { isArchived: false },
        orderBy: { purchaseDate: "desc" },
      });
    }

    const STORE_BASE_URL = "https://www.itechperu.shop";

    // Meta / WhatsApp Business Catalog standard CSV headers
    const headers = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "google_product_category"
    ];

    const escapeCsv = (str: string | number) => {
      const val = String(str ?? "").replace(/"/g, '""');
      return `"${val}"`;
    };

    const cdnImageMap: Record<string, string> = {
      'ipad-mini-5': 'https://cdn.sanity.io/images/kqneikcb/production/b737d4f68597ff767ffc14b10292eb2498654522-800x800.png',
      'ipad-pro-105': 'https://cdn.sanity.io/images/kqneikcb/production/7011d8372143b4b46d82ffeec39fdadc570bac94-800x800.png',
      'ipad-pro-129': 'https://cdn.sanity.io/images/kqneikcb/production/9097efc98b761c70309a6ab9a4acbd698cb941e1-800x800.png',
      'ipad-9': 'https://cdn.sanity.io/images/kqneikcb/production/63bf9ccb9e99c6e6083505db50021f951372e596-800x800.png',
      'ipad-air-3': 'https://cdn.sanity.io/images/kqneikcb/production/53bf215ec16b39bf7af3766dbb3b2cab62dfe919-800x800.png',
      'macbook-pro-16': 'https://cdn.sanity.io/images/kqneikcb/production/1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800.png',
      'macbook-pro-15': 'https://cdn.sanity.io/images/kqneikcb/production/407623aa9ebc4d815fb5ca5a0f88ab09a6fd36a4-800x800.png',
      'macbook-pro-13': 'https://cdn.sanity.io/images/kqneikcb/production/940ca333729ad4dc48ad5006e109506e5614e187-800x800.png',
      'dell-latitude-3330': 'https://cdn.sanity.io/images/kqneikcb/production/d88826aa275949b471b93fffddbe5ee4f956d06c-800x800.png',
      'charger-96w': 'https://cdn.sanity.io/images/kqneikcb/production/b73a6b11beaf76e29f2ed55bdcf934847911e337-800x800.png',
    };

    const rows = products.map((p) => {
      const info = getProductCatalogInfo(p);
      const isLaptop = info.category === "Laptops & MacBooks";
      const isTablet = info.category === "iPads & Tablets";
      const googleCat = isLaptop
        ? "Electronics > Computers > Laptops"
        : isTablet
        ? "Electronics > Computers > Tablet Computers"
        : "Electronics > Electronics Accessories";

      const fullDescription = `${info.displaySpecs} | ${info.cpuSpecs} | ${info.ramSpecs} | ${info.storageSpecs} | ${info.conditionLabel} | Emitimos Boleta de Venta | Testeado en 30 puntos técnicos (WiFi, audio, cámaras, pantalla, Touch ID, puertos y sensores). Detalles de segunda mano en observación. [FOTO REFERENCIAL: Equipo original exhibido en TikTok Live • WhatsApp: +51 907 674 693 / +51 924 967 876]`;

      const productLink = `${STORE_BASE_URL}/coleccion`;

      const modelKeyMatch = info.referenceImage.match(/\/catalog\/([a-z0-9-]+?)(?:-\d)?\.png/i);
      const modelKey = modelKeyMatch ? modelKeyMatch[1] : '';
      const imageUrl = cdnImageMap[modelKey] || 'https://cdn.sanity.io/images/kqneikcb/production/1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800.png';

      const cleanTitle = String(info.commercialTitle || '').replace(/\s*[•\-]\s*Ord:\s*[\w\-]+/gi, '').replace(/\\"/g, '"').trim();

      return [
        escapeCsv(p.orderNumber || p.id),
        escapeCsv(cleanTitle),
        escapeCsv(fullDescription),
        escapeCsv("in stock"),
        escapeCsv("refurbished"),
        escapeCsv(`${info.salePricePen}.00 PEN`),
        escapeCsv(productLink),
        escapeCsv(imageUrl),
        escapeCsv(info.brand),
        escapeCsv(googleCat)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="catalogo_whatsapp_business.csv"',
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error: unknown) {
    console.error("Error generating WhatsApp catalog CSV:", error);
    const message = error instanceof Error ? error.message : "Error al exportar catálogo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
