import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Enable instrumentation.ts to run before any module is loaded
  // This is critical for setting DATABASE_URL before Prisma initializes
  instrumentationHook: true,
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
