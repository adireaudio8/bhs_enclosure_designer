import { randomUUID } from 'node:crypto';
import { db, getShop, shopFilter } from './db';
import { DealerError, canonicalShop, decrypt, encrypt, requiredEnv } from './security';

export const DEALER_SCOPES = 'read_products,read_inventory,read_locations,read_publications,read_orders,write_app_proxy';
export const IDENTITY_QUERY = `query DealerIdentity { shop { name currencyCode primaryDomain { url } } }`;
interface TokenResponse { access_token: string; scope: string; expires_in: number; refresh_token: string; refresh_token_expires_in: number }

export async function exchangeToken(shop: string, grant: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`https://${canonicalShop(shop)}/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: requiredEnv('DEALER_SHOPIFY_API_KEY'), client_secret: requiredEnv('DEALER_SHOPIFY_API_SECRET'), ...grant }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new DealerError('Shopify authorization needs to be renewed. Reopen the app from Shopify.', 503);
  const data = await response.json() as TokenResponse;
  if (!data.access_token || !data.refresh_token || !(data.expires_in > 0) || !(data.refresh_token_expires_in > 0)) {
    throw new DealerError('Shopify did not return renewable store access.', 503);
  }
  const granted = new Set(data.scope.split(','));
  if (DEALER_SCOPES.split(',').some(scope => !granted.has(scope))) throw new DealerError('Required store permissions were not granted.', 403);
  return data;
}

export function tokenFields(shop: string, data: TokenResponse) {
  return {
    access_token: encrypt(data.access_token, `${shop}:access`), refresh_token: encrypt(data.refresh_token, `${shop}:refresh`),
    access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString(), scopes: data.scope,
    updated_at: new Date().toISOString(),
  };
}

export async function storeToken(shop: string): Promise<string> {
  const merchant = await getShop(shop);
  if (!merchant.access_token || !merchant.access_expires_at) throw new DealerError('Reinstall the dealer app to connect this store.', 403);
  if (Date.parse(merchant.access_expires_at) > Date.now() + 60_000) return decrypt(merchant.access_token, `${shop}:access`);
  if (!merchant.refresh_token || !merchant.refresh_expires_at || Date.parse(merchant.refresh_expires_at) <= Date.now()) {
    throw new DealerError('Reopen the dealer app in Shopify to renew access.', 403);
  }
  const lock = randomUUID();
  const acquired = await db<boolean>('rpc/bhs_dealer_refresh_lock', 'POST', { p_shop: shop, p_lock: lock });
  if (!acquired) throw new DealerError('Store access is being refreshed. Please try again shortly.', 503);
  try {
    const latest = await getShop(shop);
    if (Date.parse(latest.access_expires_at ?? '') > Date.now() + 60_000) return decrypt(latest.access_token!, `${shop}:access`);
    const data = await exchangeToken(shop, { grant_type: 'refresh_token', refresh_token: decrypt(latest.refresh_token!, `${shop}:refresh`) });
    await db(`bhs_dealer_shops?${shopFilter(shop)}&refresh_lock_id=eq.${lock}`, 'PATCH', tokenFields(shop, data));
    return data.access_token;
  } finally {
    await db(`bhs_dealer_shops?${shopFilter(shop)}&refresh_lock_id=eq.${lock}`, 'PATCH', { refresh_lock_until: null, refresh_lock_id: null });
  }
}

export async function adminGraphQL<T>(shop: string, query: string, variables: Record<string, unknown> = {}, token?: string): Promise<T> {
  const response = await fetch(`https://${canonicalShop(shop)}/admin/api/2026-04/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token ?? await storeToken(shop) },
    body: JSON.stringify({ query, variables }), cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json() as { data?: T; errors?: unknown[] };
  if (!response.ok || data.errors?.length || !data.data) throw new DealerError('The store could not verify this product. Please try again.', 503);
  return data.data;
}
