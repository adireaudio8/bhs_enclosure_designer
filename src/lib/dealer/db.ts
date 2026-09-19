import { supabaseServerHeaders } from '../supabase-server';
import { DealerError, requiredEnv } from './security';
import type { DealerShop, DealerQuote } from './types';

export async function db<T>(path: string, method = 'GET', body?: unknown, prefer = 'return=representation'): Promise<T> {
  const response = await fetch(`${requiredEnv('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/${path}`, {
    method, headers: { ...supabaseServerHeaders(), 'Content-Type': 'application/json', Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) { console.error('[dealer-db]', method, path.split('?')[0], response.status); throw new DealerError('Dealer data could not be saved. Please try again.', 503); }
  const text = await response.text(); return (text ? JSON.parse(text) : null) as T;
}

export async function getShop(shop: string): Promise<DealerShop> {
  const rows = await db<DealerShop[]>(`bhs_dealer_shops?shop=eq.${encodeURIComponent(shop)}&limit=1`);
  if (!rows[0] || rows[0].status === 'uninstalled') throw new DealerError('This store has not connected the dealer app.', 403);
  return rows[0];
}

export function assertActive(shop: DealerShop): void {
  if (shop.status !== 'active' || shop.currency !== 'USD' || !shop.publication_id || !shop.collective_location_id || !shop.shipping_confirmed || !shop.collective_payments_confirmed || !shop.pilot_verified) {
    throw new DealerError('Custom enclosure ordering is not enabled for this store yet.', 403);
  }
}

export async function getQuote(shop: string, id: string): Promise<DealerQuote | null> {
  const rows = await db<DealerQuote[]>(`bhs_dealer_quotes?shop=eq.${encodeURIComponent(shop)}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ?? null;
}

export const shopFilter = (shop: string) => `shop=eq.${encodeURIComponent(shop)}`;
