import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "BananaLens AI | Minion Banana Classifier",
  description: "Deteksi klasifikasi kematangan pisang (Ripe, Half Ripe, Unripe) dengan AI Computer Vision dan maskot Minion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} font-sans antialiased`}>
      <body className="min-h-screen bg-slate-950 text-slate-100 selection:bg-yellow-400 selection:text-slate-950 font-sans">
        {children}
      </body>
    </html>
  );
}
