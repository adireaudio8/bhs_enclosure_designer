import { renderProxyDebug } from '@/lib/proxy-debug';
import { renderDesignerProxyWrapper } from '@/lib/proxy-wrapper';

export const runtime = 'nodejs';

export function GET(req: Request) {
  const currentUrl = new URL(req.url);
  if (currentUrl.searchParams.get('bhs_debug') === '1') {
    return renderProxyDebug(
      req,
      'Dedicated Shopify app proxy target reached Vercel.',
    );
  }

  return renderDesignerProxyWrapper(req);
}
