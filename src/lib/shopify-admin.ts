const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN ?? '';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? '';
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION ?? '2026-04';

export async function shopifyAdminGraphQL<TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> {
  if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
    throw new Error('Shopify Admin API env vars are not configured.');
  }

  const res = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
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
