import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth-helper";
import { randomUUID } from "crypto";

const isPlaceholder = (val?: string) =>
  !val || val.startsWith("your-") || val === "";

function getEbayUrls() {
  const isSandbox = process.env.EBAY_SANDBOX === "true";
  return {
    authorize: isSandbox
      ? "https://auth.sandbox.ebay.com/oauth2/authorize"
      : "https://auth.ebay.com/oauth2/authorize",
    token: isSandbox
      ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
      : "https://api.ebay.com/identity/v1/oauth2/token",
  };
}

// GET /api/ebay/auth - Generate eBay OAuth authorization URL
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;
    const ruName = process.env.EBAY_RU_NAME;

    if (isPlaceholder(appId) || isPlaceholder(certId)) {
      return NextResponse.json(
        { error: "API keys de eBay no configuradas. Configura EBAY_APP_ID y EBAY_CERT_ID en Vercel" },
        { status: 400 }
      );
    }

    if (!ruName) {
      return NextResponse.json(
        { error: "EBAY_RU_NAME no configurado. Agrega esta variable en Vercel con el RuName de eBay Developer Program." },
        { status: 400 }
      );
    }

    const { authorize } = getEbayUrls();

    // Generate CSRF state parameter
    const state = randomUUID();

    // Store state + userId in a cookie for callback verification (max-age = 10 min)
    const cookieStore = await cookies();
    cookieStore.set("ebay_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set("ebay_oauth_userId", currentUser.userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const scopes = [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    ].join(" ");

    // eBay OAuth: redirect_uri must be the RuName (not the actual HTTPS URL)
    // eBay internally maps the RuName to the configured HTTPS redirect URL
    const authUrl = new URL(authorize);
    authUrl.searchParams.set("client_id", appId!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", ruName);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    return NextResponse.json({
      url: authUrl.toString(),
      debug: {
        clientId: appId ? `${appId.substring(0, 15)}...` : "NOT SET",
        redirectUri: ruName,
        ruName: ruName ? `${ruName.substring(0, 15)}...` : "NOT SET",
        authorizeUrl: authorize,
      },
    });
  } catch (error: unknown) {
    console.error("eBay auth URL generation error:", error);
    const message = error instanceof Error ? error.message : "Error al generar URL de autorización";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
