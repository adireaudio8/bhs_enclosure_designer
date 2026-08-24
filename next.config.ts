import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const enclosureEngineRevision = readFileSync(
  join(process.cwd(), 'vendor', 'enclosure-engine.commit'),
  'utf8',
).trim().toLowerCase();

if (!/^[0-9a-f]{40}$/.test(enclosureEngineRevision)) {
  throw new Error('vendor/enclosure-engine.commit must contain an exact 40-character Git SHA.');
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  skipTrailingSlashRedirect: true,
  transpilePackages: ['@adireaudio/enclosure-engine'],
  env: {
    ENCLOSURE_ENGINE_REVISION: enclosureEngineRevision,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
