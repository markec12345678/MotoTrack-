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
  ],
};

export default nextConfig;
