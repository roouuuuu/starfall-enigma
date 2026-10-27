import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Tests build into `.next-test` so they can run while `npm run dev` keeps
  // its own `.next` directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The Express app still owns public/ and the admin workspace during the
  // migration, so Next only compiles app/ and never serves the legacy views.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
