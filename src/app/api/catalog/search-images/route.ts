import { NextRequest, NextResponse } from "next/server";

// Fallback search providers to ensure searching never returns 0 results
async function searchDuckDuckGo(query: string) {
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=["']?([^&"'\s]+)/);
    const vqd = vqdMatch ? vqdMatch[1] : null;
    if (!vqd) return [];

    const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,type:photo,,&p=1`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://duckduckgo.com/",
      },
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    if (!text.startsWith("{")) return [];
    const data = JSON.parse(text);
    return (data.results || [])
      .filter((r: any) => r.image)
      .map((r: any) => ({
        url: r.image,
        thumbnail: r.thumbnail || r.image,
        title: r.title || query,
        width: r.width,
        height: r.height,
        source: r.source || "Web",
      }));
  } catch {
    return [];
  }
}

async function searchWikimedia(query: string) {
  try {
    const cleanQ = query.replace(/[^\w\s]/gi, " ").trim();
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQ)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ImportacionesPeru/1.0 (catalog@importaciones.pe)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data.query?.pages || {};
    const results: Array<{
      url: string;
      thumbnail: string;
      title: string;
      width: number;
      height: number;
      source: string;
    }> = [];
    for (const p of Object.values(pages) as any[]) {
      const info = p.imageinfo?.[0];
      if (info?.url && /\.(jpg|jpeg|png|webp)/i.test(info.url)) {
        results.push({
          url: info.url,
          thumbnail: info.thumburl || info.url,
          title: p.title?.replace(/^File:/, "").replace(/\.\w+$/, "") || query,
          width: info.width || 800,
          height: info.height || 600,
          source: "Wikimedia Commons",
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// GET /api/catalog/search-images?q=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // Run DDG and Wikimedia in parallel
    const [ddgResults, wikiResults] = await Promise.all([
      searchDuckDuckGo(query),
      searchWikimedia(query),
    ]);

    const combined = [...ddgResults, ...wikiResults];

    return NextResponse.json({
      results: combined.slice(0, 24),
    });
  } catch (error: unknown) {
    console.error("Error in catalog/search-images:", error);
    const message = error instanceof Error ? error.message : "Error buscando imágenes";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
