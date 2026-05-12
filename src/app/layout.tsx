import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "REVER - Analiza aplikacije za motoriste",
  description: "Celovita analiza aplikacije REVER - največje GPS skupnosti za motocikliste, smučarje in terenske navdušence.",
  keywords: ["REVER", "motoristi", "GPS", "navigacija", "analiza", "motocikel", "Butler Maps"],
  authors: [{ name: "REVER Analiza" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "REVER - Analiza aplikacije za motoriste",
    description: "Celovita analiza aplikacije REVER - največje GPS skupnosti za motocikliste",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "REVER - Analiza aplikacije za motoriste",
    description: "Celovita analiza aplikacije REVER - največje GPS skupnosti za motocikliste",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
