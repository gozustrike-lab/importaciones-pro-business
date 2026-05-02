import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getEbayAccountStatus } from "@/lib/ebay-account";

// GET /api/ebay/account - Get eBay account connection status
export async function GET() {
  try {
    // Require authentication
    const currentUser = await getCurrentUser();
    if (!currentUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const status = getEbayAccountStatus();

    return NextResponse.json({
      configured: status.configured,
      connected: status.connected,
      username: status.username,
      feedbackScore: status.feedbackScore,
      feedbackPercentage: status.feedbackPercentage,
    });
  } catch (error: unknown) {
    console.error("eBay account status error:", error);
    const message = error instanceof Error ? error.message : "Error al obtener el estado de eBay";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
