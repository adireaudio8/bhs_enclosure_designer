import { NextResponse } from 'next/server';
import { DEALER_SCOPES } from '@/lib/dealer/shopify';
import { db } from '@/lib/dealer/db';
import { appOrigin, canonicalShop, errorResponse, requiredEnv, signSession } from '@/lib/dealer/security';

export async function GET(req: Request) {
  try {
    const shop = canonicalShop(new URL(req.url).searchParams.get('shop'));
    // Do not grant store access before the app's private persistence is ready.
    await db('bhs_dealer_shops?select=shop&limit=0');
    const state = signSession('oauth', shop, 600);
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.search = new URLSearchParams({ client_id: requiredEnv('DEALER_SHOPIFY_API_KEY'), scope: DEALER_SCOPES,
      redirect_uri: `${appOrigin()}/dealer/callback`, state }).toString();
    const response = NextResponse.redirect(url);
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set('bhs_dealer_oauth', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/dealer', maxAge: 600 });
    return response;
  } catch (error) { return errorResponse(error); }
}
