import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getItem } from "@/lib/ebay";

// GET /api/ebay/item/[itemId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { itemId } = await params;

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId es requerido" },
        { status: 400 }
      );
    }

    const item = await getItem(itemId);

    return NextResponse.json(item);
  } catch (error: unknown) {
    console.error("eBay get item error:", error);
    const message = error instanceof Error ? error.message : "Error al obtener el item de eBay";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
