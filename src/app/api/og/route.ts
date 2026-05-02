import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// ── Route Segment Config ────────────────────────────────────
export const runtime = "edge";

// ── GET /api/og?title=...&description=... ───────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const title = searchParams.get("title") || "ImportHub Perú";
  const description =
    searchParams.get("description") ||
    "ERP Multi-Tenant — Gestión Inteligente de Importaciones eBay a Perú";
  const type = searchParams.get("type") || "landscape"; // landscape | square

  const width = type === "square" ? 1200 : 1200;
  const height = type === "square" ? 1200 : 630;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A0F1C",
          backgroundImage:
            "radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            display: "flex",
          }}
        />

        {/* Glow accent */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Bottom glow */}
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "20px",
            zIndex: 1,
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "10px",
              boxShadow: "0 0 60px rgba(16,185,129,0.3)",
            }}
          >
            <span
              style={{
                fontSize: "40px",
                fontWeight: 700,
                color: "white",
                fontFamily: "sans-serif",
              }}
            >
              IH
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: type === "square" ? "56px" : "64px",
              fontWeight: 800,
              color: "#FFFFFF",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              fontFamily: "sans-serif",
              textShadow: "0 0 40px rgba(16,185,129,0.3)",
            }}
          >
            {title}
          </h1>

          {/* Accent line */}
          <div
            style={{
              width: "80px",
              height: "4px",
              borderRadius: "2px",
              background:
                "linear-gradient(90deg, transparent, #10B981, transparent)",
            }}
          />

          {/* Description */}
          <p
            style={{
              fontSize: type === "square" ? "22px" : "26px",
              color: "rgba(255,255,255,0.65)",
              margin: 0,
              lineHeight: 1.4,
              maxWidth: "700px",
              fontFamily: "sans-serif",
            }}
          >
            {description}
          </p>

          {/* Badges row */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "10px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {["Inventario", "Ventas", "IGV", "Tracking", "eBay"].map(
              (tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "16px",
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(16,185,129,0.12)",
                    color: "#10B981",
                    border: "1px solid rgba(16,185,129,0.25)",
                    fontWeight: 500,
                    fontFamily: "sans-serif",
                  }}
                >
                  {tag}
                </span>
              )
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "16px",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "sans-serif",
            }}
          >
            <span>importaciones-pro-business.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );
}
