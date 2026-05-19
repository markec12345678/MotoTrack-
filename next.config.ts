import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
  allowedDevOrigins: [
    "preview-chat-4a0e5d7e-260f-4e68-a19b-8c7bdf46a006.space-z.ai",
    "0.0.0.0:3000",
    "localhost:3000",
    "0.0.0.0",
  ],
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      // Allow map tile loading and external resources from any page
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            // Allow map tiles from all major providers
            // NOTE: CSP wildcards like *.example.com do NOT match the bare domain itself.
            // Both the bare domain AND the wildcard must be listed.
            "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://openstreetmap.org https://*.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com https://tiles.openfreemap.org https://api.dicebear.com https://*.maplibre.org https://*.leaflet.org https://tile.opentopomap.org https://unpkg.com https://tilecache.rainviewer.com https://api.qrserver.com",
            "connect-src 'self' https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://openstreetmap.org https://*.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com https://tiles.openfreemap.org https://api.openweathermap.org https://api.dicebear.com https://nominatim.openstreetmap.org https://overpass-api.de https://www.openstreetmap.org https://tile.opentopomap.org https://router.project-osrm.org https://unpkg.com https://tilecache.rainviewer.com https://api.qrserver.com",
            "worker-src 'self' blob:",
            "child-src 'self' blob:",
          ].join('; ')
        },
      ],
    },
  ],
};

export default nextConfig;
