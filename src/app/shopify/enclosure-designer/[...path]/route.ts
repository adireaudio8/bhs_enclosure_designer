import { renderProxyDebug } from '@/lib/proxy-debug';

export const runtime = 'nodejs';

export function GET(req: Request) {
  return renderProxyDebug(
    req,
    'Dedicated Shopify app proxy catch-all reached Vercel.',
  );
}
