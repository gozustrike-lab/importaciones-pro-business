// ── eBay Account / My Account Integration ──
// Uses eBay Shopping API or Browse API for user account data.
// Note: Full purchase history requires OAuth authorization.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";

const isPlaceholder = (val?: string) =>
  !val || val.startsWith("your-") || val === "";

/**
 * Get eBay account connection status.
 * Returns whether the API keys are configured and if a user account is connected.
 */
export function getEbayAccountStatus(): {
  configured: boolean;
  connected: boolean;
  username?: string;
  feedbackScore?: number;
  feedbackPercentage?: string;
} {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  const configured = !isPlaceholder(appId) && !isPlaceholder(certId);

  // Currently, full account connection requires OAuth flow
  // which is not yet implemented. Mark as not connected.
  return {
    configured,
    connected: false,
  };
}

/**
 * Fetch eBay user profile (placeholder).
 * In production, this would use OAuth user token to call:
 * GET https://api.ebay.com/buy/browse/v1/user/{username}
 */
export async function getEbayUserProfile(_username: string): Promise<{
  username: string;
  feedbackScore: number;
  feedbackPercentage: string;
}> {
  // Placeholder - requires OAuth user token
  throw new Error(
    "La conexión con cuenta eBay requiere autorización OAuth. Esta función estará disponible próximamente."
  );
}

/**
 * Fetch eBay purchase history (placeholder).
 * Requires OAuth authorization with scope:
 * https://api.ebay.com/oauth/api_scope/buy.order.read
 */
export async function getEbayPurchaseHistory(): Promise<unknown[]> {
  // Placeholder - requires OAuth user token
  throw new Error(
    "El historial de compras requiere autorización OAuth con tu cuenta eBay. Esta función estará disponible próximamente."
  );
}
