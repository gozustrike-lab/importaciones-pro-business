import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getEbayAccountStatus, disconnectEbay } from "@/lib/ebay-account";

// GET /api/ebay/account - Get eBay account connection status
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const status = await getEbayAccountStatus(currentUser.userId);

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

// DELETE /api/ebay/account - Disconnect eBay account
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await disconnectEbay(currentUser.userId);

    return NextResponse.json({
      message: "Cuenta eBay desconectada correctamente",
    });
  } catch (error: unknown) {
    console.error("eBay disconnect error:", error);
    const message = error instanceof Error ? error.message : "Error al desconectar eBay";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
