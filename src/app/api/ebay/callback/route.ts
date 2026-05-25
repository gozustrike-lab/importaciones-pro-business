import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

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

// GET /api/ebay/callback - Handle eBay OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
      );
    }

    // Verify CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("ebay_oauth_state")?.value;
    const userId = cookieStore.get("ebay_oauth_userId")?.value;

    // Clear cookies
    cookieStore.delete("ebay_oauth_state");
    cookieStore.delete("ebay_oauth_userId");

    if (!storedState || storedState !== state) {
      console.error("eBay OAuth: CSRF state mismatch");
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
      );
    }

    if (!userId) {
      console.error("eBay OAuth: Missing userId cookie");
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
      );
    }

    // Exchange code for tokens
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (isPlaceholder(appId) || isPlaceholder(certId)) {
      console.error("eBay OAuth: API keys not configured");
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
      );
    }

    const { token: tokenUrl } = getEbayUrls();
    // Token exchange also uses RuName as redirect_uri
    const ruName = process.env.EBAY_RU_NAME || "";

    const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: ruName,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("eBay token exchange error:", errorBody);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
      refresh_token_expires_in: number;
    };

    // Decode the access token to get the eBay user ID
    let providerAccountId = "";
    try {
      const tokenParts = tokenData.access_token.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], "base64url").toString("utf-8")
        );
        providerAccountId = payload.sub || payload.username || "";
      }
    } catch {
      console.warn("Could not decode eBay access token for user ID");
    }

    // If we couldn't get the user ID from the token, fetch it from the API
    if (!providerAccountId) {
      try {
        const baseUrl =
          process.env.EBAY_SANDBOX === "true"
            ? "https://api.sandbox.ebay.com"
            : "https://api.ebay.com";
        const userResponse = await fetch(
          `${baseUrl}/commerce/identity/v1/user/`,
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          }
        );
        if (userResponse.ok) {
          const userData = (await userResponse.json()) as { userId?: string; username?: string };
          providerAccountId = userData.userId || userData.username || "unknown";
        }
      } catch {
        providerAccountId = `ebay_${Date.now()}`;
      }
    }

    // Calculate expiration time
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    // Upsert the Account record in Prisma
    const existingAccount = await db.account.findFirst({
      where: {
        userId,
        provider: "ebay",
      },
    });

    if (existingAccount) {
      await db.account.update({
        where: { id: existingAccount.id },
        data: {
          providerAccountId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          type: "oauth",
        },
      });
    } else {
      await db.account.create({
        data: {
          userId,
          type: "oauth",
          provider: "ebay",
          providerAccountId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
        },
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=connected`
    );
  } catch (error) {
    console.error("eBay OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app"}/dashboard?tab=proveedores&ebay=error`
    );
  }
}
