import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Express app still owns public/ and the admin workspace during the
  // migration, so Next only compiles app/ and never serves the legacy views.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
