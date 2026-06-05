import crypto from 'crypto';

export interface AppProxyContext {
  shop: string | null;
  loggedInCustomerId: string | null;
  pathPrefix: string | null;
  verified: boolean;
}

function timingSafeHexCompare(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyAppProxySignature(url: URL) {
  const signature = url.searchParams.get('signature');
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!signature || !secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const params = new Map<string, string[]>();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'signature') continue;
    const values = params.get(key) ?? [];
    values.push(value);
    params.set(key, values);
  }

  const sorted = [...params.entries()]
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .sort()
    .join('');

  const calculated = crypto
    .createHmac('sha256', secret)
    .update(sorted)
    .digest('hex');

  return timingSafeHexCompare(signature, calculated);
}

export function getAppProxyContext(request: Request): AppProxyContext {
  const url = new URL(request.url);
  const verified = verifyAppProxySignature(url);

  return {
    shop: url.searchParams.get('shop'),
    loggedInCustomerId: url.searchParams.get('logged_in_customer_id') || null,
    pathPrefix: url.searchParams.get('path_prefix'),
    verified,
  };
}

export function assertAppProxyRequest(request: Request) {
  const context = getAppProxyContext(request);
  if (!context.verified) {
    throw new Response('Invalid Shopify app proxy signature', { status: 401 });
  }
  return context;
}
