import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchItems } from "@/lib/ebay";

// GET /api/ebay/search?q=iphone&limit=10&category_id=6000&sort=price
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Parámetro 'q' es requerido" },
        { status: 400 }
      );
    }

    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 10;
    const category_id = searchParams.get("category_id") || undefined;
    const sort = searchParams.get("sort") || undefined;

    // Build filter
    const conditions = searchParams.get("conditions");
    let filter = "buyingOptions:{FIXED_PRICE},buyingOptions:{AUCTION}";
    if (conditions) {
      filter = `conditionIds:{${conditions}}`;
    }

    const results = await searchItems(query, {
      limit: Math.min(limit, 50),
      category_id,
      sort,
      filter,
    });

    return NextResponse.json({
      items: results,
      total: results.length,
    });
  } catch (error: unknown) {
    console.error("eBay search error:", error);
    let message = "Error al buscar en eBay";
    if (error instanceof Error) {
      // Translate known error messages to Spanish
      const msg = error.message;
      if (msg.includes("API keys") || msg.includes("Configura tus")) {
        message = "Configura tus API keys de eBay en el archivo .env (EBAY_APP_ID y EBAY_CERT_ID)";
      } else if (msg.includes("OAuth")) {
        message = "Error de autenticación con eBay. Verifica tus API keys.";
      } else if (msg.includes("Search failed")) {
        message = "La búsqueda en eBay falló. Intenta de nuevo más tarde.";
      } else {
        message = msg;
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
