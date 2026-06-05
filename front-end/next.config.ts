import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
      // Allow server actions (including redirect()) to be invoked from the production domain.
      // Without this, Next.js may construct redirect URLs using the internal Docker hostname.
      allowedOrigins: [
        'doc-ai.my-mello.org',
        'localhost:3000',
        'localhost:3002',
      ],
    },
  },
};

export default nextConfig;