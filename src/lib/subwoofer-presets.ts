/**
 * Curated subwoofer presets for the customer designer.
 *
 * Stage B / v1: a small set of popular brands and approximate size-based
 * defaults (OD, cutout, displacement) so customers without exact specs can
 * still get a usable starting point. Real per-sub specs (per-model OD,
 * displacement) will replace this in a future iteration once we wire up
 * the calculator's subwoofer database for storefront use.
 *
 * This file is intentionally storefront-local — different curation than
 * the calculator's full database, simpler shape.
 */

export type SubwooferBrand =
  | 'Sundown Audio'
  | 'DC Audio'
  | 'JL Audio'
  | 'American Bass'
  | 'Resilient Sounds'
  | 'Trinity Audio'
  | 'Kicker'
  | 'Rockford Fosgate'
  | 'B2 Audio';

export const SUB_BRANDS: SubwooferBrand[] = [
  'Sundown Audio',
  'DC Audio',
  'JL Audio',
  'American Bass',
  'Resilient Sounds',
  'Trinity Audio',
  'Kicker',
  'Rockford Fosgate',
  'B2 Audio',
];

/**
 * Sizes the customer designer supports. Mirrors the engine's `SubwooferSize`
 * union but storefront keeps its own copy so changes here don't ripple back
 * into the engine.
 */
export const SUPPORTED_SIZES = ['8"', '10"', '12"', '13.5"', '15"', '18"'] as const;
export type SupportedSize = (typeof SUPPORTED_SIZES)[number];

/**
 * Approximate per-size defaults for OD, cutout, and displacement.
 * These are "market average" values across popular brands, not specific
 * to any single sub. The customer can override OD / cutout if they have
 * exact specs from their sub's manual.
 */
export interface SizeDefaults {
  outsideDiameter: number;     // inches
  subCutoutDiameter: number;   // inches
  subDisplacement: number;     // cu ft
  recommendedNetVolume: number; // cu ft per sub for ported tuning
  recommendedTuningHz: number;  // Hz
  recommendedPortWidthIn: number;
}

export const SIZE_DEFAULTS: Record<SupportedSize, SizeDefaults> = {
  '8"':  { outsideDiameter: 8.5,  subCutoutDiameter: 7.32,  subDisplacement: 0.05, recommendedNetVolume: 0.6, recommendedTuningHz: 35, recommendedPortWidthIn: 1.0 },
  '10"': { outsideDiameter: 10.5, subCutoutDiameter: 9.16,  subDisplacement: 0.10, recommendedNetVolume: 0.9, recommendedTuningHz: 33, recommendedPortWidthIn: 1.25 },
  '12"': { outsideDiameter: 12.5, subCutoutDiameter: 11.16, subDisplacement: 0.13, recommendedNetVolume: 1.6, recommendedTuningHz: 32, recommendedPortWidthIn: 1.5 },
  '13.5"': { outsideDiameter: 14.0, subCutoutDiameter: 12.5,  subDisplacement: 0.18, recommendedNetVolume: 2.0, recommendedTuningHz: 32, recommendedPortWidthIn: 1.5 },
  '15"': { outsideDiameter: 15.5, subCutoutDiameter: 13.93, subDisplacement: 0.22, recommendedNetVolume: 3.0, recommendedTuningHz: 32, recommendedPortWidthIn: 1.75 },
  '18"': { outsideDiameter: 18.5, subCutoutDiameter: 16.69, subDisplacement: 0.32, recommendedNetVolume: 4.5, recommendedTuningHz: 30, recommendedPortWidthIn: 2.0 },
};

/**
 * Duty tier metadata + customer-facing labels with power ranges.
 * Power numbers are guidance — adjust to match what Andre actually wants
 * to recommend per duty tier.
 */
export type DutyKey = 'SD' | 'RD' | 'HD';

export const DUTY_OPTIONS: Array<{
  key: DutyKey;
  enclosureType: string;       // matches engine's EnclosureType union
  label: string;               // shown in dropdown
}> = [
  {
    key: 'SD',
    enclosureType: 'Birch Ply - Standard Duty',
    label: 'Standard Duty (up to 1000W RMS)',
  },
  {
    key: 'RD',
    enclosureType: 'Birch Ply - Regular Duty',
    label: 'Regular Duty (1000–2000W RMS)',
  },
  {
    key: 'HD',
    enclosureType: 'Birch Ply - Heavy Duty',
    label: 'Heavy Duty (2000W+ RMS)',
  },
];

export function dutyKeyFromEnclosureType(enclosureType: string): DutyKey {
  if (enclosureType.includes('Heavy')) return 'HD';
  if (enclosureType.includes('Standard')) return 'SD';
  return 'RD';
}

/**
 * Customer-facing tiered price matrix keyed by (size, quantity, duty).
 * These values are PLACEHOLDERS — adjust to match the storefront catalog's
 * actual prices for equivalent enclosure tiers. Pricing logic uses these
 * directly rather than a per-design cost calculation, so changing port
 * width / dimensions won't shift the price.
 *
 * Once Andre confirms real numbers, just edit the values here and push.
 * Or, switch the app-proxy pricing route to query Supabase for live prices.
 */
export const PRICE_MATRIX: Record<
  SupportedSize,
  Record<'Single' | 'Dual', Record<DutyKey, number>>
> = {
  '8"':    { Single: { SD: 425,  RD: 525,  HD: 625  }, Dual: { SD: 650,  RD: 775,  HD: 900  } },
  '10"':   { Single: { SD: 525,  RD: 625,  HD: 750  }, Dual: { SD: 750,  RD: 900,  HD: 1075 } },
  '12"':   { Single: { SD: 600,  RD: 725,  HD: 875  }, Dual: { SD: 875,  RD: 1050, HD: 1250 } },
  '13.5"': { Single: { SD: 650,  RD: 775,  HD: 925  }, Dual: { SD: 925,  RD: 1100, HD: 1325 } },
  '15"':   { Single: { SD: 750,  RD: 900,  HD: 1075 }, Dual: { SD: 1075, RD: 1275, HD: 1525 } },
  '18"':   { Single: { SD: 875,  RD: 1050, HD: 1250 }, Dual: { SD: 1250, RD: 1500, HD: 1800 } },
};

/**
 * Look up the tiered catalog price for a custom enclosure config.
 * Returns null if the size/qty/duty combo isn't in the matrix; caller
 * should fall back to a cost-based calculation in that case.
 */
export function lookupCatalogPrice(
  size: SupportedSize,
  quantity: 'Single' | 'Dual',
  duty: DutyKey,
): number | null {
  return PRICE_MATRIX[size]?.[quantity]?.[duty] ?? null;
}

/**
 * Suggest external box dimensions (depth, height) for a given size +
 * quantity that yield approximately the recommended internal volume after
 * accounting for material thickness and port displacement. The customer
 * can adjust these — they're starting points, not fixed.
 *
 * Math: target external volume ≈ recommendedNetVolume × subCount × 1.6
 * (the 1.6 multiplier covers material + port + sub displacement). Then
 * we estimate width based on sub count + OD (since the engine computes
 * actual width from sub count later — we can't influence it directly,
 * but we need a width estimate to back-solve depth from volume), then
 * derive depth = volume ÷ (height × estimated width).
 */
export type SubQuantityWord = 'Single' | 'Dual' | 'Triple' | 'Quad';

export function subCountFromQuantity(quantity: SubQuantityWord): number {
  switch (quantity) {
    case 'Single': return 1;
    case 'Dual':   return 2;
    case 'Triple': return 3;
    case 'Quad':   return 4;
  }
}

export function suggestBoxDimensions(
  size: SupportedSize,
  quantity: SubQuantityWord,
): { boxDepth: number; boxHeight: number } {
  const defaults = SIZE_DEFAULTS[size];
  const subCount = subCountFromQuantity(quantity);

  // Target external volume in cubic inches. The 1.6× multiplier accounts
  // for material thickness + port displacement + sub displacement.
  const externalCuIn = defaults.recommendedNetVolume * subCount * 1.6 * 1728;

  // Height: clearance below sub cutout + general roominess
  const minHeight = defaults.outsideDiameter + 2.5;
  const boxHeight = Math.max(minHeight, 13);

  // Width estimate — the engine actually computes width from sub count
  // later, so this is approximate. ~OD × (subCount + 0.5) + 2" margin.
  const estimatedWidth = defaults.outsideDiameter * (subCount + 0.5) + 2;

  // Depth = volume ÷ (height × width), rounded to 1/4"
  let boxDepth = (externalCuIn / (boxHeight * estimatedWidth));
  boxDepth = Math.round(boxDepth * 4) / 4;

  // Floor: don't go shallower than ~10" or sub OD + 2" (whichever is more)
  const minDepth = Math.max(10, defaults.outsideDiameter * 0.85 + 2);
  return {
    boxDepth: Math.max(boxDepth, minDepth),
    boxHeight,
  };
}
