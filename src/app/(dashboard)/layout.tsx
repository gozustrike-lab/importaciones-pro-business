import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard — ImportHub Perú",
  description:
    "Panel principal de ImportHub Perú. Gestiona inventario, ventas, clientes, impuestos, tracking y analítica de importaciones eBay a Perú.",
  openGraph: {
    title: "ImportHub Perú — Dashboard de Importaciones",
    description:
      "Gestiona tus importaciones de eBay a Perú en tiempo real. KPIs, inventario, ventas, CRM, impuestos SUNAT y más.",
    images: ["/og-image-landscape.png"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {children}
    </div>
  );
}
