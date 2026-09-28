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
import { calculateEnclosure, detectMaterial, generateModelNumber, resolveModifiedMAP,
  type EnclosureInputs, type ResolveModifiedMAPResult } from '@adireaudio/enclosure-engine';
import { dutyKeyFromEnclosureType, type SupportedSize } from '@/lib/subwoofer-presets';
import { getAppProxyContext } from '@/lib/app-proxy';
import { resolvePositiveOnlinePrice, sanitizeCustomerEnclosureInputs } from '@/lib/customer-enclosure-boundary';
import { lookupPricingTier, lookupSupabasePriceRow, lookupPricingModifierConfig, priceForTier, type PricingRow, type PricingTier } from '@/lib/design-pricing';
export const runtime = 'nodejs';
const LEAD_TIME_DAYS = 21;

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

  // Automatic labyrinth routing is part of the shared geometry engine, but
  // its manual manufacturing override is intentionally unavailable to
  // storefront customers—even if a crafted request includes the field.
  inputs = sanitizeCustomerEnclosureInputs(inputs);

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
  let modifiedPrice: ResolveModifiedMAPResult | null = null;
  try {
    const calc = calculateEnclosure(inputs);
    baffleStatus = calc.baffleCheck.status;

    const dutyKey = dutyKeyFromEnclosureType(inputs.enclosureType);
    const customerVolume = Number(inputs.netAirSpace) || 0;

    const [resolvedTier, resolvedRow, modifiers] = await Promise.all([
      lookupPricingTier(proxyContext),
      lookupSupabasePriceRow(
        inputs.size as SupportedSize,
        dutyKey,
        customerVolume,
      ),
      lookupPricingModifierConfig(),
    ]);
    tier = resolvedTier;
    row = resolvedRow;

    if (row) {
      const designName = generateModelNumber(inputs);
      const size = String(inputs.size).replace(/"/g, '').replace(/”/g, '').trim();
      modifiedPrice = resolveModifiedMAP({
        designName,
        size,
        baseMap: Number(row.map_price),
        modifiers,
        inputs: inputs as unknown as Record<string, unknown>,
        material: detectMaterial(inputs.enclosureType),
      });
    }
  } catch (err) {
    console.error('[design-pricing] computation failed:', err);
    return NextResponse.json(
      { error: 'Pricing computation failed' },
      { status: 500 },
    );
  }

  const tieredPrice = resolvePositiveOnlinePrice(
    row && modifiedPrice ? priceForTier(row, tier, modifiedPrice) : null,
  );

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
    price: Math.round(tieredPrice * 100) / 100,
    leadTimeDays: LEAD_TIME_DAYS,
    baffleStatus,
    priceSource: 'supabase' as const,
    appliedModifiers: modifiedPrice?.applied ?? [],
    modifierBreakdown: modifiedPrice?.breakdown ?? [],
    tier, // 'guest' | 'customer' | 'dealer' | 'distributor' — UI shows badge
  });
}
