import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Iniciar Sesión — ImportHub Perú",
    template: "%s — ImportHub Perú",
  },
  description: "Accede a tu panel de gestión de importaciones. ERP Multi-Tenant SaaS para importadores eBay a Perú.",
  openGraph: {
    title: "ImportHub Perú — Accede a tu ERP",
    description: "Inicia sesión para gestionar tus importaciones, inventario, ventas y más.",
    images: ["/og-image-landscape.png"],
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
