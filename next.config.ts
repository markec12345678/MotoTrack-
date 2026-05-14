import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // instrumentationHook is enabled by default in Next.js 14+
  // No need to specify it explicitly (removed - was causing config warning)
  // @libsql/client uses native bindings that must be externalized
  // for Vercel serverless functions to work correctly.
  serverExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
  allowedDevOrigins: [
    "preview-chat-4a0e5d7e-260f-4e68-a19b-8c7bdf46a006.space-z.ai",
  ],
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
};

export default nextConfig;
