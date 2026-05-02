import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXTAUTH_URL || "https://importaciones-pro-business.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#10B981",
};

export const metadata: Metadata = {
  // ── Base ──────────────────────────────────────────────
  title: {
    default: "ImportHub Perú — ERP de Importaciones Inteligente",
    template: "%s | ImportHub Perú",
  },
  description:
    "Gestiona tus importaciones de eBay a Perú desde un solo lugar. Inventario, ventas, impuestos (IGV, Ad-valorem, Percepción), tracking y analítica en tiempo real. SaaS Multi-Tenant.",
  keywords: [
    "importaciones",
    "Perú",
    "eBay",
    "ERP",
    "importHub",
    "importar",
    "iPads",
    "MacBook",
    "iPhone",
    "SUNAT",
    "NRUS",
    "IGV",
    "ad-valorem",
    "gestión de importaciones",
    "inventario",
    "SaaS",
    "multi-tenant",
  ],
  authors: [{ name: "ImportHub Perú", url: siteUrl }],
  creator: "Fabio Herrera Bonilla",
  publisher: "ImportHub Perú SAC",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Icons ─────────────────────────────────────────────
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },

  // ── Open Graph (Facebook, LinkedIn, WhatsApp, Discord) ─
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: siteUrl,
    siteName: "ImportHub Perú",
    title: "ImportHub Perú — ERP de Importaciones Inteligente",
    description:
      "Gestiona tus importaciones de eBay a Perú. Inventario, ventas, impuestos, tracking y analítica en tiempo real.",
    images: [
      {
        url: "/og-image-landscape.png",
        width: 1344,
        height: 768,
        alt: "ImportHub Perú — Tu ERP de Importaciones",
        type: "image/png",
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "ImportHub Perú — ERP de Importaciones Inteligente",
    description:
      "Gestiona tus importaciones de eBay a Perú. Inventario, ventas, impuestos, tracking y analítica en tiempo real.",
    images: ["/og-image-landscape.png"],
    creator: "@importhubpe",
  },

  // ── Other Platforms ───────────────────────────────────
  other: {
    "og:country-name": "Perú",
    "og:email": "admin@importhub.pe",
    "og:phone_number": "",
    "og:type": "product",
    "product:brand": "ImportHub Perú",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "ImportHub Perú",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "ERP Multi-Tenant SaaS para gestión de importaciones eBay a Perú",
              url: siteUrl,
              author: {
                "@type": "Organization",
                name: "ImportHub Perú SAC",
                founder: {
                  "@type": "Person",
                  name: "Fabio Herrera Bonilla",
                },
              },
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "PEN",
                lowPrice: "0",
                highPrice: "299",
                offerCount: "3",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.9",
                ratingCount: "87",
              },
            }),
          }}
        />
        {/* WhatsApp Preview Enhancement */}
        <meta property="og:image" content={`${siteUrl}/og-image-square.png`} />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta property="og:image:type" content="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
