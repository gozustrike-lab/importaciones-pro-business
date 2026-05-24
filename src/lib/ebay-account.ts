// ── eBay Account / OAuth Integration ──
// Manages eBay user OAuth tokens and API calls requiring user authorization.

import { db } from "@/lib/db";

const isPlaceholder = (val?: string) =>
  !val || val.startsWith("your-") || val === "";

function getEbayTokenUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";
}

/**
 * Get eBay account connection status for a given userId.
 * Checks Prisma Account table for an eBay provider entry.
 */
export async function getEbayAccountStatus(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  username?: string;
  feedbackScore?: number;
  feedbackPercentage?: string;
}> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  const configured = !isPlaceholder(appId) && !isPlaceholder(certId);

  // Check if user has an eBay account connected
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "ebay",
    },
  });

  if (!account || !account.access_token) {
    return { configured, connected: false };
  }

  return {
    configured,
    connected: true,
    username: account.providerAccountId,
  };
}

/**
 * Get a valid eBay user access token for the given userId.
 * If the token is expired or about to expire, refreshes it automatically.
 */
export async function getUserToken(userId: string): Promise<string> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "ebay",
    },
  });

  if (!account || !account.access_token) {
    throw new Error("No hay cuenta eBay conectada para este usuario");
  }

  const now = Math.floor(Date.now() / 1000);

  // If token expires in less than 5 minutes, refresh it
  if (account.expires_at && account.expires_at - 300 < now) {
    return refreshUserToken(account.refresh_token!, account.id);
  }

  return account.access_token;
}

/**
 * Refresh an eBay user access token using the stored refresh token.
 */
async function refreshUserToken(
  refreshToken: string,
  accountId: string
): Promise<string> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (isPlaceholder(appId) || isPlaceholder(certId)) {
    throw new Error("API keys de eBay no configuradas");
  }

  const tokenUrl = getEbayTokenUrl();
  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope:
        "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.order.readonly https://api.ebay.com/oauth/api_scope/sell.marketing.readonly https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("eBay token refresh error:", errorBody);
    // If refresh fails, the tokens are invalid — delete the account record
    await db.account.delete({ where: { id: accountId } }).catch(() => {});
    throw new Error(
      "No se pudo renovar el token de eBay. Reconecta tu cuenta."
    );
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  // Update the stored tokens
  await db.account.update({
    where: { id: accountId },
    data: {
      access_token: tokenData.access_token,
      // eBay may or may not return a new refresh token
      ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
      expires_at: expiresAt,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    },
  });

  return tokenData.access_token;
}

/**
 * Disconnect an eBay account for the given userId.
 * Deletes the eBay Account record from the database.
 */
export async function disconnectEbay(userId: string): Promise<void> {
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "ebay",
    },
  });

  if (account) {
    await db.account.delete({ where: { id: account.id } });
  }
}
