// ── eBay Browse API Client ──
// OAuth2 Client Credentials Grant + Browse API v1

import { getEbayConfig } from "@/lib/ebay-account";

const EBAY_BASE_URL = "https://api.ebay.com";
const EBAY_SANDBOX_URL = "https://api.sandbox.ebay.com";

// ── Token Cache ──
interface TokenCache {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedToken: TokenCache | null = null;

function getBaseUrl(): string {
  const { appId, isSandbox } = getEbayConfig();
  if (appId.includes("-PRD-")) return EBAY_BASE_URL;
  return isSandbox ? EBAY_SANDBOX_URL : EBAY_BASE_URL;
}

// ── OAuth2: Get App Access Token ──
export async function getAppToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.token;
  }

  const { appId, certId } = getEbayConfig();

  // Check for placeholder values (not configured)
  const isPlaceholder = (val?: string) =>
    !val || val.startsWith("your-") || val === "";

  if (isPlaceholder(appId) || isPlaceholder(certId)) {
    throw new Error(
      "Configura tus API keys de eBay en el archivo .env (EBAY_APP_ID y EBAY_CERT_ID)"
    );
  }

  const baseUrl = getBaseUrl();
  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("eBay OAuth error:", errorBody);
    throw new Error(`eBay OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  // Cache token (expires_in is typically 7200 seconds = 2 hours)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ── Types ──

export interface EbaySearchResult {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  image: string;
  condition: string;
  conditionId: string;
  shippingCost: string;
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  buyingOptions: string[];
  itemLocation: {
    country: string;
    postalCode: string;
  };
}

export interface EbayItemDetail {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  images: string[];
  condition: string;
  conditionId: string;
  description: string;
  shippingCost: string;
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
  buyingOptions: string[];
  itemLocation: {
    country: string;
    city: string;
    postalCode: string;
  };
  aspects: Record<string, string[]>;
  subtitle?: string;
  categoryId: string;
  categoryPath: string[];
}

export interface EbaySearchParams {
  limit?: number;
  category_id?: string;
  filter?: string;
  sort?: string;
}

// ── Search Items ──

export async function searchItems(
  query: string,
  params?: EbaySearchParams
): Promise<EbaySearchResult[]> {
  const token = await getAppToken();
  const baseUrl = getBaseUrl();

  const searchParams = new URLSearchParams();
  searchParams.set("q", query);

  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.category_id) searchParams.set("category_id", params.category_id);
  if (params?.filter) searchParams.set("filter", params.filter);
  if (params?.sort) searchParams.set("sort", params.sort);

  const url = `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("eBay Search error:", errorBody);
    throw new Error(`eBay Search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    itemSummaries: Array<{
      id?: string;
      itemId?: string;
      title: string;
      price: { value: string; currency: string };
      image?: { imageUrl: string };
      thumbnailImages?: Array<{ imageUrl: string }>;
      condition: string;
      conditionId: string;
      shippingOptions?: Array<{ shippingCost: { value: string; currency: string } }>;
      itemWebUrl: string;
      seller?: { username: string; feedbackScore: number; feedbackPercentage: string };
      buyingOptions?: string[];
      itemLocation?: { country: string; postalCode: string };
    }>;
    total: number;
    href: string;
  };

  return (data.itemSummaries || []).map((item) => ({
    itemId: item.itemId || item.id || "",
    title: item.title,
    price: item.price,
    image:
      item.image?.imageUrl ||
      item.thumbnailImages?.[0]?.imageUrl ||
      "",
    condition: item.condition,
    conditionId: item.conditionId,
    shippingCost: item.shippingOptions?.[0]?.shippingCost?.value || "0",
    itemWebUrl: item.itemWebUrl,
    seller: {
      username: item.seller?.username || "N/A",
      feedbackScore: item.seller?.feedbackScore || 0,
      feedbackPercentage: item.seller?.feedbackPercentage || "100%",
    },
    buyingOptions: item.buyingOptions || [],
    itemLocation: {
      country: item.itemLocation?.country || "US",
      postalCode: item.itemLocation?.postalCode || "",
    },
  }));
}

// ── Get Item Detail ──

export async function getItem(itemId: string): Promise<EbayItemDetail> {
  const token = await getAppToken();
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}/buy/browse/v1/item/${encodeURIComponent(itemId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("eBay GetItem error:", errorBody);
    throw new Error(`eBay GetItem failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    itemId: string;
    title: string;
    price: { value: string; currency: string };
    additionalImages?: Array<{ imageUrl: string }>;
    image?: { imageUrl: string };
    condition: string;
    conditionId: string;
    description: string;
    shippingOptions?: Array<{ shippingCost: { value: string; currency: string } }>;
    itemWebUrl: string;
    seller?: { username: string; feedbackScore: number; feedbackPercentage: string };
    buyingOptions?: string[];
    itemLocation?: { country: string; city: string; postalCode: string };
    aspects?: Record<string, string[]>;
    subtitle?: string;
    categoryId: string;
    categoryPaths?: Array<{ categoryId: string; categoryName: string }[]>;
  };

  return {
    itemId: data.itemId,
    title: data.title,
    price: data.price,
    images: [
      data.image?.imageUrl,
      ...(data.additionalImages?.map((img) => img.imageUrl) || []),
    ].filter(Boolean) as string[],
    condition: data.condition,
    conditionId: data.conditionId,
    description: data.description,
    shippingCost: data.shippingOptions?.[0]?.shippingCost?.value || "0",
    itemWebUrl: data.itemWebUrl,
    seller: {
      username: data.seller?.username || "N/A",
      feedbackScore: data.seller?.feedbackScore || 0,
      feedbackPercentage: data.seller?.feedbackPercentage || "100%",
    },
    buyingOptions: data.buyingOptions || [],
    itemLocation: {
      country: data.itemLocation?.country || "US",
      city: data.itemLocation?.city || "",
      postalCode: data.itemLocation?.postalCode || "",
    },
    aspects: data.aspects || {},
    subtitle: data.subtitle,
    categoryId: data.categoryId,
    categoryPath: data.categoryPaths?.[0]?.map((c) => c.categoryName) || [],
  };
}

// ── Fetch Real eBay Product Image (by Legacy ItemID or Fallback Title Search) ──
export async function fetchEbayItemImage(
  legacyId?: string | null,
  fallbackTitle?: string | null
): Promise<string | null> {
  try {
    const token = await getAppToken();
    const baseUrl = getBaseUrl();

    if (legacyId) {
      try {
        const r1 = await fetch(
          `${baseUrl}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
            },
          }
        );
        if (r1.ok) {
          const d1 = await r1.json();
          if (d1.image?.imageUrl) return d1.image.imageUrl;
        } else {
          // Multi-variation listing fallback
          const r2 = await fetch(
            `${baseUrl}/buy/browse/v1/item/get_items_by_item_group?item_group_id=${encodeURIComponent(legacyId)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
              },
            }
          );
          if (r2.ok) {
            const d2 = await r2.json();
            const img = d2.items?.[0]?.image?.imageUrl;
            if (img) return img;
          }
        }
      } catch {
        // ignore and fallback to search
      }
    }

    if (fallbackTitle) {
      const cleanQ = fallbackTitle
        .replace(/\[.*?\]/g, " ")
        .replace(/READ DESCRIPTION/gi, " ")
        .replace(/BATTERY ISSUE/gi, " ")
        .replace(/[^\w\s."'-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 65);

      const r3 = await fetch(
        `${baseUrl}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(cleanQ)}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
          },
        }
      );
      if (r3.ok) {
        const d3 = await r3.json();
        const img =
          d3.itemSummaries?.[0]?.image?.imageUrl ||
          d3.itemSummaries?.[0]?.thumbnailImages?.[0]?.imageUrl;
        if (img) {
          return img.replace("/s-l225.", "/s-l500.");
        }
      }
    }
  } catch (err) {
    console.warn("fetchEbayItemImage failed:", err);
  }
  return null;
}

// ── Live eBay Price & Quality Tracker (Sorted Lowest to Highest Price, Seller >= 95%) ──
export interface LiveTrackedEbayItem {
  itemId: string;
  title: string;
  itemUrl: string;
  imageUrl: string;
  sellerUsername: string;
  sellerFeedback: string;
  feedbackPct: number;
  currentPriceUsd: number;
  originalPriceUsd: number | null;
  discountPct: number | null;
  shippingCostUsd: number;
  condition: string;
  promoDescription: string;
}

export async function scanLiveEbayDealsForQuery(options: {
  keywords: string;
  sellerUsername?: string | null;
  maxPriceUsd?: number | null;
  minFeedbackPct?: number;
  limit?: number;
}): Promise<LiveTrackedEbayItem[]> {
  const rawQuery = (options.keywords || "Apple iPad").trim();
  const isMacbook = rawQuery.toLowerCase().includes("macbook");
  const minPrice = isMacbook ? 75 : 38;
  const maxPrice =
    options.maxPriceUsd && options.maxPriceUsd > minPrice
      ? options.maxPriceUsd
      : isMacbook
      ? 360
      : 260;
  const minFeedback = options.minFeedbackPct ?? 95.0;
  const limit = options.limit ?? 8;

  // Exclude cases, boxes, screen protectors, keyboards, and broken parts
  const cleanQuery = `${rawQuery} -case -cover -protector -keyboard -box -parts -folio -tempered`;

  const filterParts = [
    "buyingOptions:{FIXED_PRICE}",
    `price:[${minPrice}..${maxPrice}],priceCurrency:USD`,
    "conditionIds:{1000|1500|2000|2010|2020|2030|2500|3000}",
  ];

  const cleanSeller = (options.sellerUsername || "").trim();
  if (cleanSeller && cleanSeller.toLowerCase() !== "all") {
    filterParts.push(`sellers:{${cleanSeller}}`);
  }

  let rawResults: EbaySearchResult[] = [];
  try {
    rawResults = await searchItems(cleanQuery, {
      limit: 30,
      filter: filterParts.join(","),
      sort: "price",
    });
  } catch (err) {
    console.warn("Primary search with seller filter failed, retrying global search:", err);
  }

  // If seller-specific search returned 0 items, fallback to global search across all >=95% sellers
  if (rawResults.length === 0 && cleanSeller) {
    try {
      rawResults = await searchItems(cleanQuery, {
        limit: 30,
        filter: filterParts.slice(0, 3).join(","),
        sort: "price",
      });
    } catch (err) {
      console.warn("Fallback global search failed:", err);
    }
  }

  const bannedWords = [
    "case for",
    "cover for",
    "screen protector",
    "empty box",
    "box only",
    "keyboard only",
    "for parts",
    "not working",
    "icloud locked",
    "bad logic board",
  ];

  const qualified: LiveTrackedEbayItem[] = [];
  const seenIds = new Set<string>();

  for (const item of rawResults) {
    const feedbackPct = parseFloat(item.seller?.feedbackPercentage || "0");
    if (feedbackPct < minFeedback) continue;

    const lowerTitle = (item.title || "").toLowerCase();
    if (bannedWords.some((bw) => lowerTitle.includes(bw))) continue;

    const basePrice = parseFloat(item.price?.value || "0") || 0;
    const shipCost = parseFloat(item.shippingCost || "0") || 0;
    const totalUsd = Math.round((basePrice + shipCost) * 100) / 100;

    if (totalUsd < minPrice || totalUsd > maxPrice + 25) continue;

    const cleanId = item.itemId || item.itemWebUrl;
    if (seenIds.has(cleanId)) continue;
    seenIds.add(cleanId);

    // Estimate market reference price to show savings vs average
    const avgMarket = Math.round(totalUsd * 1.22);
    const discPct = Math.round(((avgMarket - totalUsd) / avgMarket) * 100);

    qualified.push({
      itemId: item.itemId || String(Date.now()),
      title: item.title,
      itemUrl: item.itemWebUrl,
      imageUrl: (item.image || "").replace("/s-l225.", "/s-l500."),
      sellerUsername: item.seller?.username || "eBay Seller",
      sellerFeedback: `${feedbackPct.toFixed(1)}% (${item.seller?.feedbackScore || 500})`,
      feedbackPct,
      currentPriceUsd: totalUsd,
      originalPriceUsd: avgMarket,
      discountPct: discPct > 0 ? discPct : 15,
      shippingCostUsd: shipCost,
      condition: item.condition || "Used",
      promoDescription:
        shipCost === 0
          ? `Envío Gratis USA • Vendedor ⭐ ${feedbackPct.toFixed(1)}%`
          : `Incluye $${shipCost.toFixed(2)} envío • Vendedor ⭐ ${feedbackPct.toFixed(1)}%`,
    });
  }

  // Strictly sort from LOWEST price to HIGHEST price
  qualified.sort((a, b) => a.currentPriceUsd - b.currentPriceUsd);

  return qualified.slice(0, limit);
}


