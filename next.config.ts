import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@adireaudio/enclosure-engine'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
