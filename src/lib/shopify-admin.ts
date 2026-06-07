const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN ?? '';
const STATIC_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? process.env.SHOPIFY_API_KEY ?? '';
const API_SECRET = process.env.SHOPIFY_API_SECRET ?? '';
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? '2026-04';

let cachedAdminToken: { token: string; expiresAt: number } | null = null;

async function requestAdminToken() {
  if (!SHOP_DOMAIN || !CLIENT_ID || !API_SECRET) {
    throw new Error('Shopify Admin API env vars are not configured.');
  }

  const res = await fetch(`https://${SHOP_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: API_SECRET,
    }),
    cache: 'no-store',
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    const message = json.error_description || json.error || `Shopify token request ${res.status}`;
    throw new Error(message);
  }

  const ttlMs = Math.max(60, Number(json.expires_in ?? 3600) - 60) * 1000;
  cachedAdminToken = {
    token: json.access_token,
    expiresAt: Date.now() + ttlMs,
  };

  return cachedAdminToken.token;
}

async function getAdminToken() {
  if (STATIC_ADMIN_TOKEN) return STATIC_ADMIN_TOKEN;
  if (cachedAdminToken && cachedAdminToken.expiresAt > Date.now()) {
    return cachedAdminToken.token;
  }
  return requestAdminToken();
}

export async function shopifyAdminGraphQL<TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> {
  if (!SHOP_DOMAIN) {
    throw new Error('Shopify Admin API env vars are not configured.');
  }

  const adminToken = await getAdminToken();

  const res = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const json = (await res.json()) as {
    data?: TData;
    errors?: Array<{ message: string }>;
  };

  if (!res.ok || json.errors?.length || !json.data) {
    const message = json.errors?.map((error) => error.message).join('; ') || `Shopify Admin API ${res.status}`;
    throw new Error(message);
  }

  return json.data;
}
