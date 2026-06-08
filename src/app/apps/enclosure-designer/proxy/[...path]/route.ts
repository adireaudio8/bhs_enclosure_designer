import { renderProxyDebug } from '@/lib/proxy-debug';

export const runtime = 'nodejs';

export function GET(req: Request) {
  return renderProxyDebug(
    req,
    'Catch-all app proxy route reached Vercel. Shopify or the browser requested an extra path under the proxy target.',
  );
}
