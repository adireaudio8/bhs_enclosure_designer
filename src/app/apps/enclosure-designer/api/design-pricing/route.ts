/**
 * POST /apps/enclosure-designer/api/design-pricing
 *
 * Server-validated pricing for the custom enclosure designer.
 *
 * Pricing source: Supabase `pricing` table — same source the calculator uses
 * (`/api/pricing/lookup`). Volume-based round-up tier match keyed on
 * (size, build_type, net_cubic_feet). The price column returned depends on
 * the visitor's pricing tier (resolved from Shopify customer tags when the
 * app proxy sends a logged-in customer ID):
 *   - guest / customer        → map_price (customer-facing MAP)
 *   - dealer / distributor    → dealer_price (wholesale rate)
 *
 * Distributors don't get the 60%-off-MAP "distro" rate on customs — only
 * on stock products. Custom enclosures pay the dealer rate regardless of
 * which B2B tier the account is.
 *
 * If Supabase is unreachable / env vars missing / no row exists for the
 * (size, duty, volume) combo, we deliberately do NOT fall back to a
 * computed or placeholder price — better to refuse a quote than show a
 * wrong number. The route returns 503 with `priceUnavailable: true` and
 * the designer page shows a "contact us to complete this order" CTA.
 */

import { NextResponse } from 'next/server';
import {
  calculateEnclosure,
  type EnclosureInputs,
} from '@adireaudio/enclosure-engine';
import {
  dutyKeyFromEnclosureType,
  type SupportedSize,
} from '@/lib/subwoofer-presets';
import { getAppProxyContext, type AppProxyContext } from '@/lib/app-proxy';
import { shopifyAdminGraphQL } from '@/lib/shopify-admin';

export const runtime = 'nodejs';

const LEAD_TIME_DAYS = 21;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

type PricingTier = 'guest' | 'customer' | 'dealer' | 'distributor';

interface PricingRow {
  size: string;
  net_cubic_feet: number;
  map_price: number;
  dealer_price: number | null;
  build_type: string;
}

/**
 * Resolve the visitor's pricing tier from Shopify customer tags.
 * App proxies send `logged_in_customer_id` when the shopper is signed in.
 * Missing Admin credentials or customer read access falls back to retail.
 */
async function lookupPricingTier(context: AppProxyContext): Promise<PricingTier> {
  if (!context.loggedInCustomerId) return 'guest';

  const customerId = context.loggedInCustomerId.startsWith('gid://')
    ? context.loggedInCustomerId
    : `gid://shopify/Customer/${context.loggedInCustomerId}`;

  try {
    const data = await shopifyAdminGraphQL<{
      customer: { tags: string[] } | null;
    }>(
      `#graphql
      query CustomerPricingTier($id: ID!) {
        customer(id: $id) {
          tags
        }
      }`,
      { id: customerId },
    );

    const tags = new Set((data.customer?.tags ?? []).map((tag) => tag.toLowerCase()));
    if (tags.has('distributor') || tags.has('bhs:distributor')) return 'distributor';
    if (tags.has('dealer') || tags.has('bhs:dealer')) return 'dealer';
    return 'customer';
  } catch (err) {
    console.warn('[design-pricing] customer tier lookup failed:', err);
    return 'customer';
  }
}

/**
 * Volume-based round-up tier match against the shared Supabase `pricing`
 * table. Mirrors the calculator's `/api/pricing/lookup` semantics so both
 * surfaces resolve to the same MAP price for the same (size, duty, volume).
 *
 * Returns null when env vars are missing, the fetch fails, or no rows
 * exist for the (size, build_type) combo — caller surfaces a 503 to the
 * designer page so the customer is told to contact us instead of seeing
 * an arbitrary fallback price.
 */
async function lookupSupabasePriceRow(
  size: SupportedSize,
  duty: 'SD' | 'RD' | 'HD',
  volume: number,
): Promise<PricingRow | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const cleanSize = String(size).replace(/"/g, '').replace(/”/g, '').trim();
  const url =
    `${SUPABASE_URL}/rest/v1/pricing` +
    `?build_type=eq.${duty}` +
    `&size=eq.${encodeURIComponent(cleanSize)}` +
    `&select=size,net_cubic_feet,map_price,dealer_price,build_type` +
    `&order=net_cubic_feet.asc`;

  let rows: PricingRow[] = [];
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[design-pricing] supabase pricing lookup failed', res.status);
      return null;
    }
    rows = (await res.json()) as PricingRow[];
  } catch (err) {
    console.error('[design-pricing] supabase pricing fetch error:', err);
    return null;
  }

  if (!rows.length) return null;

  // Exact match → round up → highest fallback (same order as calculator).
  const exact = rows.find((r) => r.net_cubic_feet === volume);
  if (exact) return exact;

  const roundedUp = rows.find((r) => r.net_cubic_feet > volume);
  if (roundedUp) return roundedUp;

  return rows[rows.length - 1] ?? null;
}

/**
 * Pick the right price column for the visitor's tier:
 *   - dealer / distributor → dealer_price column (wholesale)
 *   - customer / guest     → map_price column (default)
 *
 * Distributors get dealer pricing on customs, not 60%-off-MAP — that
 * "distro" rate only applies to stock products in the Pricing tab.
 *
 * Returns null if the row is missing the required column for the tier
 * (e.g. dealer asked for a row whose dealer_price wasn't populated).
 */
function priceForTier(row: PricingRow, tier: PricingTier): number | null {
  if (tier === 'dealer' || tier === 'distributor') {
    const dealer = Number(row.dealer_price);
    return dealer > 0 ? dealer : null;
  }
  const map = Number(row.map_price);
  return map > 0 ? map : null;
}

export async function POST(req: Request) {
  const proxyContext = getAppProxyContext(req);
  if (!proxyContext.verified) {
    return NextResponse.json(
      { error: 'Invalid Shopify app proxy signature' },
      { status: 401 },
    );
  }

  let inputs: EnclosureInputs;
  try {
    inputs = (await req.json()) as EnclosureInputs;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const required: (keyof EnclosureInputs)[] = [
    'size',
    'subwooferQuantity',
    'enclosureConfiguration',
    'enclosureType',
    'boxDepth',
    'boxHeight',
    'portWidth',
    'tuningFrequency',
    'subCutoutDiameter',
    'outsideDiameter',
  ];
  for (const k of required) {
    if (inputs[k] === undefined || inputs[k] === null || inputs[k] === '') {
      return NextResponse.json(
        { error: `Missing required input: ${k}` },
        { status: 400 },
      );
    }
  }
  if ((inputs.boxDepth ?? 0) <= 0 || (inputs.boxHeight ?? 0) <= 0) {
    return NextResponse.json(
      { error: 'Box dimensions must be positive' },
      { status: 400 },
    );
  }

  let baffleStatus: string;
  let row: PricingRow | null;
  let tier: PricingTier;
  try {
    const calc = calculateEnclosure(inputs);
    baffleStatus = calc.baffleCheck.status;

    const dutyKey = dutyKeyFromEnclosureType(inputs.enclosureType);
    const customerVolume = Number(inputs.netAirSpace) || 0;

    [tier, row] = await Promise.all([
      lookupPricingTier(proxyContext),
      lookupSupabasePriceRow(
        inputs.size as SupportedSize,
        dutyKey,
        customerVolume,
      ),
    ]);
  } catch (err) {
    console.error('[design-pricing] computation failed:', err);
    return NextResponse.json(
      { error: 'Pricing computation failed' },
      { status: 500 },
    );
  }

  const tieredPrice = row ? priceForTier(row, tier) : null;

  // No price available → tell the client explicitly so the UI can show a
  // "contact us" CTA instead of inventing a number. Baffle status is still
  // returned so the customer sees their dimensional warnings.
  if (tieredPrice === null || tieredPrice <= 0) {
    return NextResponse.json(
      {
        priceUnavailable: true,
        baffleStatus,
        leadTimeDays: LEAD_TIME_DAYS,
        tier,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    price: Math.round(tieredPrice),
    leadTimeDays: LEAD_TIME_DAYS,
    baffleStatus,
    priceSource: 'supabase' as const,
    tier, // 'guest' | 'customer' | 'dealer' | 'distributor' — UI shows badge
  });
}
