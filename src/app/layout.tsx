import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MotoTrack - GPS Sledenje za Motoriste",
  description: "MotoTrack - Aplikacija za sledenje, načrtovanje in raziskovanje motociklističnih poti po Sloveniji.",
  keywords: ["MotoTrack", "motoristi", "GPS", "navigacija", "motocikel", "sledenje", "poti"],
  authors: [{ name: "MotoTrack" }],
  manifest: "/manifest.json",
  applicationName: "MotoTrack",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MotoTrack",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png" },
    ],
  },
  openGraph: {
    title: "MotoTrack - GPS Sledenje za Motoriste",
    description: "Aplikacija za sledenje, načrtovanje in raziskovanje motociklističnih poti",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MotoTrack - GPS Sledenje za Motoriste",
    description: "Aplikacija za sledenje, načrtovanje in raziskovanje motociklističnih poti",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PwaRegister />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
