import { renderProxyDebug } from '@/lib/proxy-debug';
import { renderDesignerProxyWrapper } from '@/lib/proxy-wrapper';

export const runtime = 'nodejs';

function redirectToThemeDesignerPage() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/pages/design-your-enclosure',
      'Cache-Control': 'no-store',
    },
  });
}

export function GET(req: Request) {
  const currentUrl = new URL(req.url);
  if (currentUrl.searchParams.get('bhs_debug') === '1') {
    return renderProxyDebug(
      req,
      'Dedicated Shopify app proxy target reached Vercel.',
    );
  }

  const isSignedShopifyProxyRequest =
    currentUrl.searchParams.has('signature') &&
    currentUrl.searchParams.has('path_prefix');

  if (
    isSignedShopifyProxyRequest &&
    currentUrl.searchParams.get('embedded') !== '1'
  ) {
    return redirectToThemeDesignerPage();
  }

  return renderDesignerProxyWrapper(req);
}
