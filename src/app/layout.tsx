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
        {/* CRITICAL: Leaflet CSS overrides MUST be in a raw style tag to bypass Tailwind v4 CSS processing.
            Tailwind v4 preflight resets: img { max-width:100%; height:auto; display:block; } which destroys Leaflet tiles.
            Putting overrides in globals.css doesn't work on Vercel because Tailwind's compiler strips/weakens !important. */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Fix tile images - Tailwind resets img to max-width:100% + display:block */
          .leaflet-container img,
          .leaflet-tile-container img,
          .leaflet-tile-pane img,
          .leaflet-tile img {
            max-width: none !important;
            max-height: none !important;
            width: 256px !important;
            height: 256px !important;
            display: inline !important;
            position: absolute !important;
            border: none !important;
            outline: none !important;
            padding: 0 !important;
            margin: 0 !important;
            vertical-align: baseline !important;
            opacity: 1 !important;
            visibility: inherit !important;
          }
          /* Fix SVG icons in Leaflet controls */
          .leaflet-container svg {
            max-width: none !important;
            max-height: none !important;
            display: inline !important;
          }
          /* Ensure tile container renders properly */
          .leaflet-tile {
            visibility: inherit !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            transition: none !important;
          }
          .leaflet-tile-loaded {
            visibility: inherit !important;
          }
          /* Fix Leaflet container sizing */
          .leaflet-container {
            width: 100% !important;
            height: 100% !important;
            font-family: inherit !important;
            position: absolute !important;
            inset: 0 !important;
          }
          /* Fix pane stacking - Tailwind may reset z-index via * selector */
          .leaflet-pane {
            z-index: auto !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
          .leaflet-map-pane { z-index: auto !important; }
          .leaflet-tile-pane { z-index: 2 !important; transition: none !important; }
          .leaflet-overlay-pane { z-index: 4 !important; }
          .leaflet-shadow-pane { z-index: 5 !important; }
          .leaflet-marker-pane { z-index: 6 !important; }
          .leaflet-tooltip-pane { z-index: 7 !important; }
          .leaflet-popup-pane { z-index: 8 !important; }
          .leaflet-top, .leaflet-bottom { z-index: auto !important; position: absolute !important; }
          /* Fix control positioning */
          .leaflet-control { position: relative !important; z-index: auto !important; clear: both !important; }
          .leaflet-control-zoom { z-index: auto !important; }
          .leaflet-control-attribution { z-index: auto !important; }
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
        ` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
// MotoTrack: Force Leaflet tile images to render correctly (bypasses Tailwind v4 CSS resets)
// This MutationObserver watches for new img elements inside .leaflet-tile-pane and forces correct styles
(function() {
  function fixTile(el) {
    if (el.tagName === 'IMG' && el.closest && el.closest('.leaflet-tile-pane')) {
      el.style.maxWidth = 'none';
      el.style.maxHeight = 'none';
      el.style.width = '256px';
      el.style.height = '256px';
      el.style.display = 'inline';
      el.style.position = 'absolute';
      el.style.opacity = '1';
      el.style.visibility = 'inherit';
    }
  }
  
  // Fix existing tiles
  document.addEventListener('DOMContentLoaded', function() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            fixTile(node);
            if (node.querySelectorAll) {
              node.querySelectorAll('.leaflet-tile-pane img').forEach(fixTile);
            }
          }
        });
      });
    });
    
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // Also periodically fix tiles (belt and suspenders approach)
    setInterval(function() {
      var tiles = document.querySelectorAll('.leaflet-tile-pane img');
      tiles.forEach(fixTile);
    }, 2000);
  });
})();
`,
          }}
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
