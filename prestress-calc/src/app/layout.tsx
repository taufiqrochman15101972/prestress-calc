import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PRESTRESS-CALC — Desain Beton Prategang",
  description: "Aplikasi desain gelagar beton prategang pasca-tarik (ACI 318 / SNI 2847 / AASHTO LRFD)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-gray-100 antialiased">{children}</body>
    </html>
  );
}
