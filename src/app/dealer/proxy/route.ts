import { assertActive, getShop } from '@/lib/dealer/db';
import { appOrigin, errorResponse, signSession, verifyShopifyQuery } from '@/lib/dealer/security';
import { renderDealerProxy } from '@/lib/dealer/proxy-wrapper';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shop = await getShop(verifyShopifyQuery(url, true));
    assertActive(shop);
    return new Response(renderDealerProxy(appOrigin(), signSession('shopper', shop.shop, 7200), url.searchParams.get('cart_root') || '/'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) { return errorResponse(error); }
}
