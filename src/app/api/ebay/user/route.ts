import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { getUserToken } from "@/lib/ebay-account";

// GET /api/ebay/user - Get eBay user profile using stored OAuth token
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = await getUserToken(currentUser.userId);

    const baseUrl =
      process.env.EBAY_SANDBOX === "true"
        ? "https://api.sandbox.ebay.com"
        : "https://api.ebay.com";

    const response = await fetch(`${baseUrl}/commerce/identity/v1/user/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("eBay user profile error:", errorBody);
      return NextResponse.json(
        { error: "No se pudo obtener el perfil de eBay" },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      userId?: string;
      username?: string;
      email?: string;
      accountType?: string;
      registrationDate?: string;
      feedbackRatingStar?: string;
      feedbackScore?: number;
      feedbackPercentage?: number;
      businessAccount?: boolean;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: {
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
        countryCode?: string;
      };
      country?: string;
    };

    return NextResponse.json({
      userId: data.userId,
      username: data.username,
      email: data.email,
      accountType: data.accountType,
      registrationDate: data.registrationDate,
      feedbackRatingStar: data.feedbackRatingStar,
      feedbackScore: data.feedbackScore,
      feedbackPercentage: data.feedbackPercentage,
      businessAccount: data.businessAccount,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      country: data.country,
    });
  } catch (error: unknown) {
    console.error("eBay user profile error:", error);
    const message = error instanceof Error ? error.message : "Error al obtener perfil de eBay";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
