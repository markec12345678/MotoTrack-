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
        {/* Leaflet CSS - loaded from local /public folder */}
        <link rel="stylesheet" href="/leaflet.css" />

        {/* MapLibre GL CSS - loaded from local /public folder for 3D map */}
        <link rel="stylesheet" href="/maplibre-gl.css" />

        {/* Leaflet CSS overrides to fix Tailwind v4 preflight conflicts.
            Tailwind v4 preflight: img { max-width:100%; height:auto; display:block; }
            These overrides MUST be outside @layer and use !important to win. */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Fix tile images - Tailwind v4 preflight breaks Leaflet tiles */
          .leaflet-container .leaflet-tile-pane img,
          .leaflet-container .leaflet-shadow-pane img,
          .leaflet-container .leaflet-marker-pane img,
          .leaflet-container img.leaflet-image-layer,
          .leaflet-container .leaflet-tile {
            max-width: none !important;
            max-height: none !important;
          }
          /* Fix SVG icons in Leaflet controls */
          .leaflet-container svg {
            max-width: none !important;
            max-height: none !important;
          }
          /* Custom Leaflet markers */
          .custom-marker { background: none !important; border: none !important; }
          /* Leaflet popup override */
          .leaflet-popup-content-wrapper { border-radius: 12px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important; }
          .leaflet-popup-content { margin: 10px 14px !important; font-size: 13px !important; line-height: 1.5 !important; }
          /* Fix Leaflet zoom controls from Tailwind reset */
          .leaflet-container .leaflet-control-zoom-in,
          .leaflet-container .leaflet-control-zoom-out {
            font-size: 18px !important;
            text-indent: 0 !important;
            line-height: normal !important;
            text-align: center !important;
            display: block !important;
          }
          /* Larger controls for touch on mobile */
          .leaflet-control-zoom a {
            width: 36px !important;
            height: 36px !important;
            line-height: 36px !important;
            font-size: 18px !important;
          }

          /* ===== MapLibre GL CSS overrides - Tailwind v4 preflight fixes ===== */
          /* Tailwind v4 preflight breaks MapLibre GL canvas and tile rendering */
          .maplibregl-map {
            font: 12px/20px Helvetica Neue, Arial, Helvetica, sans-serif !important;
            overflow: hidden !important;
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
          }
          .maplibregl-map img,
          .maplibregl-map canvas {
            max-width: none !important;
            max-height: none !important;
            width: auto !important;
            height: auto !important;
          }
          .maplibregl-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
          .maplibregl-map svg {
            max-width: none !important;
            max-height: none !important;
          }
          /* Fix MapLibre popup content from Tailwind resets */
          .maplibregl-popup-content {
            font-size: 13px !important;
            line-height: 1.5 !important;
          }
          /* Fix MapLibre controls from Tailwind resets */
          .maplibregl-ctrl button {
            display: block !important;
          }
          .maplibregl-ctrl button span {
            display: block !important;
          }
          /* Fix MapLibre attribution from Tailwind resets */
          .maplibregl-ctrl-attrib {
            font-size: 10px !important;
          }
        ` }} />

        {/* Chunk load retry script - handles server instability */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
// MotoTrack Chunk Load Retry - handles server instability
(function() {
  var MAX_RETRIES = 8;
  var RETRY_DELAY = 1500;
  var retryCount = {};

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

  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && (e.reason.name === 'ChunkLoadError' ||
        (e.reason.message && e.reason.message.indexOf('Failed to load chunk') !== -1))) {
      e.preventDefault();
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
