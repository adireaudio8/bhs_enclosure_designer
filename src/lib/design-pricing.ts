/** Shared pricing lookups. BHS storefront customer tiers are separate from Collective settlement. */
import { DEFAULT_PRICING_MODIFIERS, migrateFromLegacyDiscounts, parsePricingModifiers,
  type PricingModifiersConfig, type ResolveModifiedMAPResult } from '@adireaudio/enclosure-engine';
import type { SupportedSize } from '@/lib/subwoofer-presets';
import type { AppProxyContext } from '@/lib/app-proxy';
import { shopifyAdminGraphQL } from '@/lib/shopify-admin';
import { SUPABASE_SERVER_KEY, supabaseServerHeaders } from '@/lib/supabase-server';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = SUPABASE_SERVER_KEY;

export type PricingTier = 'guest' | 'customer' | 'dealer' | 'distributor';

export interface PricingRow {
  size: string;
  net_cubic_feet: number;
  map_price: number;
  dealer_price: number | null;
  build_type: string;
}

interface AppSettingRow {
  key: string;
  value: string;
}

/**
 * Resolve the visitor's pricing tier from Shopify customer tags.
 * App proxies send `logged_in_customer_id` when the shopper is signed in.
 * Missing Admin credentials or customer read access falls back to retail.
 */
export async function lookupPricingTier(context: AppProxyContext): Promise<PricingTier> {
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
export async function lookupSupabasePriceRow(
  size: SupportedSize,
  duty: 'SD' | 'RD' | 'HD',
  volume: number,
  allowHighestFallback = true,
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
      headers: supabaseServerHeaders(),
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

  return allowHighestFallback ? rows[rows.length - 1] ?? null : null;
}

export async function lookupPricingModifierConfig(): Promise<PricingModifiersConfig> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return DEFAULT_PRICING_MODIFIERS;

  const url =
    `${SUPABASE_URL}/rest/v1/app_settings` +
    `?select=key,value` +
    `&key=in.(pricing_modifiers,flat_pack_discount_percent,foundation_discount_percent)`;

  try {
    const res = await fetch(url, {
      headers: supabaseServerHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[design-pricing] app_settings lookup failed:', res.status);
      return DEFAULT_PRICING_MODIFIERS;
    }

    const rows = (await res.json()) as AppSettingRow[];
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;

    if (settings.pricing_modifiers) {
      return mergePricingModifiersWithDefaults(parsePricingModifiers(settings.pricing_modifiers));
    }

    const legacyFlatPack = Number.parseFloat(settings.flat_pack_discount_percent || '25') || 25;
    const legacyFoundation = Number.parseFloat(settings.foundation_discount_percent || '30') || 30;
    return migrateFromLegacyDiscounts(legacyFlatPack, legacyFoundation);
  } catch (err) {
    console.warn('[design-pricing] app_settings fetch error:', err);
    return DEFAULT_PRICING_MODIFIERS;
  }
}

function mergePricingModifiersWithDefaults(
  config: PricingModifiersConfig,
): PricingModifiersConfig {
  const storedById = new Map(config.modifiers.map((modifier) => [modifier.id, modifier]));
  const defaultIds = new Set(DEFAULT_PRICING_MODIFIERS.modifiers.map((modifier) => modifier.id));
  const mergedDefaults = DEFAULT_PRICING_MODIFIERS.modifiers.map(
    (modifier) => storedById.get(modifier.id) ?? modifier,
  );
  const customModifiers = config.modifiers.filter((modifier) => !defaultIds.has(modifier.id));

  return {
    ...config,
    version: Math.max(config.version || 1, DEFAULT_PRICING_MODIFIERS.version),
    modifiers: [...mergedDefaults, ...customModifiers],
  };
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
export function priceForTier(
  row: PricingRow,
  tier: PricingTier,
  modified: ResolveModifiedMAPResult,
): number | null {
  const baseMap = Number(row.map_price);
  const finalMap = Number(modified.finalMap);
  if (!Number.isFinite(baseMap) || baseMap <= 0 || !Number.isFinite(finalMap) || finalMap <= 0) {
    return null;
  }

  if (tier === 'dealer' || tier === 'distributor') {
    const baseDealer = Number(row.dealer_price);
    if (!Number.isFinite(baseDealer) || baseDealer <= 0) return null;

    // Preserve the exact Supabase dealer base that is already live, then apply
    // modifier deltas at the same 60%-of-MAP dealer rule the calculator uses.
    const mapDelta = finalMap - baseMap;
    return Math.round((baseDealer + mapDelta * 0.6) * 100) / 100;
  }

  return finalMap;
}
