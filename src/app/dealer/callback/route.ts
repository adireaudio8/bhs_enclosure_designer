import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db, shopFilter } from '@/lib/dealer/db';
import { IDENTITY_QUERY, adminGraphQL, exchangeToken, tokenFields } from '@/lib/dealer/shopify';
import { DealerError, appOrigin, equal, errorResponse, readSession, signSession, verifyShopifyQuery } from '@/lib/dealer/security';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shop = verifyShopifyQuery(url);
    const state = url.searchParams.get('state')!;
    const cookie = (await cookies()).get('bhs_dealer_oauth')?.value ?? '';
    if (!cookie || !equal(state, cookie) || readSession(state, 'oauth').shop !== shop) throw new DealerError('The installation session has expired. Please start again.', 401);
    const token = await exchangeToken(shop, { code: url.searchParams.get('code')!, expiring: '1' });
    const identity = await adminGraphQL<{ shop: { name: string; currencyCode: string; primaryDomain: { url: string } } }>(shop, IDENTITY_QUERY, {}, token.access_token);
    const existing = await db<{ status: string }[]>(`bhs_dealer_shops?${shopFilter(shop)}&select=status&limit=1`);
    const fields = { shop, ...tokenFields(shop, token), name: identity.shop.name, currency: identity.shop.currencyCode, storefront_url: identity.shop.primaryDomain.url };
    if (existing.length) {
      await db(`bhs_dealer_shops?${shopFilter(shop)}`, 'PATCH', { ...fields, ...(existing[0].status === 'uninstalled' ? { status: 'pending', pilot_verified: false, collective_payments_confirmed: false, shipping_confirmed: false } : {}) });
    } else await db('bhs_dealer_shops', 'POST', fields);
    const response = NextResponse.redirect(`${appOrigin()}/dealer`);
    response.cookies.set('bhs_dealer_oauth', '', { path: '/dealer', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' });
    response.cookies.set('bhs_dealer_merchant', signSession('merchant', shop, 3600), { path: '/dealer', maxAge: 3600, httpOnly: true, secure: true, sameSite: 'lax' });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return errorResponse(error); }
}
