import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: 'standalone',
  // Pin the workspace root to this folder. Without it, Next walks up looking
  // for a lockfile and can land on one in the user's home directory, which
  // makes file tracing (and the standalone build) trace the wrong tree.
  outputFileTracingRoot: path.join(__dirname),
  // A production build and a running `next dev` share `.next` and overwrite
  // each other's chunks ("Cannot find module './611.js'"). Set NEXT_DIST_DIR
  // to build into a scratch folder while the dev server keeps running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // three ships untranspiled ESM in its examples/addons, which drei pulls in.
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
