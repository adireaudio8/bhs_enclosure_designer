import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class DealerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new DealerError('The dealer app is not configured yet.', 503);
  return value;
}

export function canonicalShop(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(value)) {
    throw new DealerError('Open the app from your Shopify admin. The store address could not be verified.');
  }
  const shop = value.toLowerCase();
  const allowed = process.env.DEALER_ALLOWED_SHOPS?.trim();
  if (allowed && !allowed.split(',').map(entry => entry.trim().toLowerCase()).includes(shop)) {
    throw new DealerError('This pilot installation is not available for this store. Contact BHS for access.', 403);
  }
  return shop;
}

export function equal(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hmac(value: string, secret: string, encoding: 'hex' | 'base64' | 'base64url' = 'hex') {
  return createHmac('sha256', secret).update(value).digest(encoding);
}

export function verifyShopifyQuery(url: URL, proxy = false, now = Date.now()): string {
  const params = url.searchParams;
  const signatureKey = proxy ? 'signature' : 'hmac';
  for (const key of ['shop', 'timestamp', signatureKey, ...(proxy ? [] : ['code', 'state'])]) {
    if (params.getAll(key).length !== 1) throw new DealerError('Invalid Shopify request.', 401);
  }
  const shop = canonicalShop(params.get('shop'));
  const timestamp = Number(params.get('timestamp')) * 1000;
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300_000) {
    throw new DealerError('This Shopify request has expired. Please open the app again.', 401);
  }
  const grouped = new Map<string, string[]>();
  for (const [key, value] of params) {
    if (key === signatureKey || (!proxy && key === 'signature')) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  const pairs = [...grouped].map(([key, values]) => `${key}=${values.join(',')}`).sort();
  const digest = hmac(pairs.join(proxy ? '' : '&'), requiredEnv('DEALER_SHOPIFY_API_SECRET'));
  if (!equal(digest, params.get(signatureKey) ?? '')) throw new DealerError('Invalid Shopify signature.', 401);
  return shop;
}

export interface DealerSession { purpose: 'shopper' | 'merchant' | 'oauth' | 'operator'; shop: string; nonce: string; exp: number }

export function signSession(purpose: DealerSession['purpose'], shop: string, seconds: number): string {
  const secret = requiredEnv('DEALER_SESSION_SECRET');
  if (secret.length < 32) throw new DealerError('The dealer session key must contain at least 32 characters.', 503);
  const payload = Buffer.from(JSON.stringify({ purpose, shop, nonce: randomBytes(24).toString('hex'), exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url');
  return `${payload}.${hmac(payload, secret, 'base64url')}`;
}

export function readSession(token: string, purpose: DealerSession['purpose']): DealerSession {
  const parts = token.split('.');
  if (parts.length !== 2 || token.length > 2048 || !equal(hmac(parts[0], requiredEnv('DEALER_SESSION_SECRET'), 'base64url'), parts[1])) {
    throw new DealerError('Your session has expired. Please reopen the designer.', 401);
  }
  let data: DealerSession;
  try { data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { throw new DealerError('Invalid session.', 401); }
  if (data.purpose !== purpose || !Number.isFinite(data.exp) || data.exp <= Date.now() / 1000 || typeof data.nonce !== 'string') {
    throw new DealerError('Your session has expired. Please reopen the designer.', 401);
  }
  if (purpose !== 'operator') canonicalShop(data.shop);
  return data;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(requiredEnv('DEALER_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new DealerError('The dealer encryption key must be 32 bytes encoded as base64.', 503);
  return key;
}

export function encrypt(value: string, context: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(x => x.toString('base64url')).join('.');
}

export function decrypt(value: string, context: string): string {
  const parts = value.split('.').map(x => Buffer.from(x, 'base64url'));
  if (parts.length !== 3) throw new DealerError('Stored credentials could not be read.', 503);
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), parts[0]);
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(parts[1]);
  return Buffer.concat([cipher.update(parts[2]), cipher.final()]).toString('utf8');
}

export function verifyWebhook(body: string, signature: string | null): void {
  if (!signature || !equal(hmac(body, requiredEnv('DEALER_SHOPIFY_API_SECRET'), 'base64'), signature)) {
    throw new DealerError('Invalid webhook signature.', 401);
  }
}

export function appOrigin(): string {
  const url = new URL(requiredEnv('DEALER_APP_URL'));
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) {
    throw new DealerError('The dealer app requires HTTPS.', 503);
  }
  return url.origin;
}

export function assertSameOrigin(req: Request): void {
  if (req.headers.get('origin') !== appOrigin()) throw new DealerError('Invalid form origin.', 403);
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new DealerError('The request is too large.', 413);
  try { const body = JSON.parse(text); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body; }
  catch { throw new DealerError('Invalid JSON request.'); }
}

export function errorResponse(error: unknown): Response {
  if (!(error instanceof DealerError)) console.error('[dealer-app]', error instanceof Error ? error.message : 'Unexpected failure');
  return Response.json({ error: error instanceof DealerError ? error.message : 'The dealer service could not complete this request. Please try again.' }, { status: error instanceof DealerError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
