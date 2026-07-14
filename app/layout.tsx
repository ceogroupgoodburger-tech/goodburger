import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "GOOD BURGER - A Casa do Hambúrguer!",
    description: "Cardápio online da Good Burger: hambúrgueres, porções, combos e bebidas.",
    manifest: "/manifest.json",
    icons: {
      icon: "/assets/goodburger/logo.jpg",
      shortcut: "/assets/goodburger/logo.jpg",
    },
    openGraph: {
      title: "GOOD BURGER - A Casa do Hambúrguer!",
      description: "Hambúrgueres, combos, porções e bebidas em Guarapari.",
      type: "website",
      url: baseUrl,
      images: [{ url: new URL("/og.png", baseUrl), width: 1200, height: 630, alt: "Good Burger" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "GOOD BURGER - A Casa do Hambúrguer!",
      description: "Hambúrgueres, combos, porções e bebidas em Guarapari.",
      images: [new URL("/og.png", baseUrl)],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
