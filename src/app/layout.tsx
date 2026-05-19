import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";
import { ErrorBoundary } from "@/components/error-boundary";

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
  authors: [{ name: "Markec" }],
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
      <head>
        {/* Leaflet CSS loaded from CDN to bypass Tailwind v4 CSS processing which breaks Leaflet styles */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
// MotoTrack Chunk Load Retry - handles server instability
(function() {
  var MAX_RETRIES = 8;
  var RETRY_DELAY = 1500;
  var retryCount = {};
  
  // Intercept script errors and retry loading
  document.addEventListener('error', function(e) {
    var el = e.target;
    if (el && el.tagName === 'SCRIPT' && el.src) {
      var src = el.src;
      if (!retryCount[src]) retryCount[src] = 0;
      if (retryCount[src] < MAX_RETRIES) {
        retryCount[src]++;
        setTimeout(function() {
          var newScript = document.createElement('script');
          newScript.src = src;
          newScript.async = true;
          if (el.integrity) newScript.integrity = el.integrity;
          document.head.appendChild(newScript);
        }, RETRY_DELAY * retryCount[src]);
      }
    }
  }, true);
  
  // Intercept link stylesheet errors
  document.addEventListener('error', function(e) {
    var el = e.target;
    if (el && el.tagName === 'LINK' && el.rel === 'stylesheet' && el.href) {
      var href = el.href;
      if (!retryCount[href]) retryCount[href] = 0;
      if (retryCount[href] < MAX_RETRIES) {
        retryCount[href]++;
        setTimeout(function() {
          var newLink = document.createElement('link');
          newLink.rel = 'stylesheet';
          newLink.href = href;
          document.head.appendChild(newLink);
        }, RETRY_DELAY * retryCount[href]);
      }
    }
  }, true);
  
  // Handle uncaught ChunkLoadError from Next.js dynamic imports
  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && (e.reason.name === 'ChunkLoadError' || 
        (e.reason.message && e.reason.message.indexOf('Failed to load chunk') !== -1))) {
      e.preventDefault();
      // Auto-retry by reloading the page after delay
      setTimeout(function() { window.location.reload(); }, 3000);
    }
  });
})();
`,
          }}
        />
      </head>
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
