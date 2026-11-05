import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";

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
  themeColor: "#0F172A",
};

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ImportHub',
  },
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
    "laptops",
    "SUNAT",
    "aduanas",
    "tracking",
    "inventario",
    "ventas",
    "SaaS",
    "multi-tenant",
  ],
  authors: [{ name: "ImportHub Perú Team" }],
  creator: "ImportHub Perú",
  publisher: "ImportHub Perú SAC",

  // ── OpenGraph (Facebook, WhatsApp, LinkedIn) ──────────
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: siteUrl,
    siteName: "ImportHub Perú",
    title: "ImportHub Perú — ERP de Importaciones Inteligente",
    description:
      "Control de inventario, ventas, tracking en vivo y cálculo automático de impuestos de importación para tu negocio.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ImportHub Perú — Plataforma de Gestión de Importaciones",
      },
    ],
  },

  // ── Twitter Card ──────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "ImportHub Perú — ERP de Importaciones Inteligente",
    description:
      "Control de inventario, ventas, tracking en vivo y cálculo de impuestos para importaciones de eBay.",
    images: [`${siteUrl}/og-image.png`],
    creator: "@importhubpe",
  },

  // ── Icons / Favicon ───────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },

  // ── Robots ────────────────────────────────────────────
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

  // ── Verification ──────────────────────────────────────
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },

  // ── Alternates ────────────────────────────────────────
  alternates: {
    canonical: siteUrl,
  },

  // ── Category ──────────────────────────────────────────
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');document.documentElement.style.colorScheme='light';}else{document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-100 text-slate-900 dark:bg-[#070D19] dark:text-slate-100 transition-colors duration-150`}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
