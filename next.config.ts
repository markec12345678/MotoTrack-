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
      // Permissive CSP for map-heavy app — tiles come from many external providers
      // Using 'https:' scheme allows all HTTPS resources while blocking insecure HTTP
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            // Scripts: allow self + eval (needed for MapLibre GL) + inline + Vercel analytics
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
            // Styles: allow self + inline (Tailwind) + Google Fonts
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            // Images: allow ALL https sources (map tiles from any provider) + data/blob URLs
            "img-src 'self' data: blob: https:",
            // Connect (fetch/XHR/WebSocket): allow ALL https sources (tiles, APIs, weather, routing)
            "connect-src 'self' https: wss:",
            // Fonts: self + Google Fonts
            "font-src 'self' https://fonts.gstatic.com",
            // Workers: needed by MapLibre GL for vector tile parsing
            "worker-src 'self' blob:",
            // Frames/children: Vercel live preview
            "child-src 'self' blob:",
            // Frame ancestors: prevent clickjacking
            "frame-ancestors 'self'",
          ].join('; ')
        },
      ],
    },
  ],
};

export default nextConfig;
