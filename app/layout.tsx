import type { Metadata } from "next";
import { Battambang, Fraunces, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
// Khmer OS Battambang: use the locally installed font when present, otherwise
// Google's "Battambang" (same design) so every visitor sees the same face.
const khmer = Battambang({
  subsets: ["khmer"],
  weight: ["400", "700"],
  variable: "--font-khmer-web",
});

export const metadata: Metadata = {
  title: "IMS – Inventory Management System",
  description: "Inventory and warehouse management for Cambodian trade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} ${khmer.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
