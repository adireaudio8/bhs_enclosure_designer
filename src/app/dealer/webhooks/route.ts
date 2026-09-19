import { db, shopFilter } from '@/lib/dealer/db';
import { reconcileDealerOrder } from '@/lib/dealer/orders';
import { DealerError, canonicalShop, encrypt, errorResponse, verifyWebhook } from '@/lib/dealer/security';

export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (Buffer.byteLength(text) > 2_000_000) throw new DealerError('Webhook too large.', 413);
    verifyWebhook(text, req.headers.get('x-shopify-hmac-sha256'));
    const shop = canonicalShop(req.headers.get('x-shopify-shop-domain'));
    const topic = req.headers.get('x-shopify-topic') ?? '';
    const data = JSON.parse(text);
    if (topic === 'app/uninstalled') {
      if (canonicalShop(data.myshopify_domain) !== shop) throw new DealerError('Store mismatch.', 401);
      await db(`bhs_dealer_shops?${shopFilter(shop)}`, 'PATCH', { status: 'uninstalled', access_token: null, refresh_token: null, access_expires_at: null, refresh_expires_at: null, pilot_verified: false });
    } else if (['customers/data_request', 'customers/redact', 'shop/redact'].includes(topic)) {
      if (canonicalShop(data.shop_domain) !== shop) throw new DealerError('Store mismatch.', 401);
      const eventId = req.headers.get('x-shopify-event-id') ?? req.headers.get('x-shopify-webhook-id');
      if (!eventId) throw new DealerError('Missing event reference.');
      // Do not discard privacy requests; encrypted durable inbox supports operator fulfillment/audit.
      await db('bhs_dealer_privacy_requests?on_conflict=shop,event_id', 'POST', {
        shop, event_id: eventId, topic, request_data: encrypt(text, `${shop}:privacy`),
      }, 'resolution=ignore-duplicates,return=minimal');
      if (topic === 'shop/redact') await db(`bhs_dealer_shops?${shopFilter(shop)}`, 'PATCH', { status: 'uninstalled', access_token: null, refresh_token: null, pilot_verified: false });
    } else if (['orders/paid', 'orders/updated', 'orders/cancelled', 'refunds/create'].includes(topic)) {
      const numericId = topic === 'refunds/create' ? data.order_id : data.id;
      const orderId = topic !== 'refunds/create' && typeof data.admin_graphql_api_id === 'string' ? data.admin_graphql_api_id
        : Number.isSafeInteger(numericId) ? `gid://shopify/Order/${numericId}` : '';
      await reconcileDealerOrder(shop, orderId);
    } else throw new DealerError('Unsupported webhook topic.', 400);
    return new Response(null, { status: 200 });
  } catch (error) { return errorResponse(error); }
}
