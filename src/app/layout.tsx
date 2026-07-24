import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"]
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Futrol - Forja tu leyenda",
  description: "RPG narrativo basado en decisiones con tarjetas."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} ${cinzel.variable} font-sans`}>{children}</body>
    </html>
  );
}
