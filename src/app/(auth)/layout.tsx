import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ImportHub Perú — Iniciar Sesión",
  description: "Inicia sesión en tu cuenta de ImportHub Perú",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
