import { createHash, randomUUID } from 'node:crypto';
import {
  calculateEnclosure, checkSubwooferPlacement, checkWindowPlacement, generateCutList, generateModelNumber,
  detectMaterial, resolveModifiedMAP, DEFAULT_INPUTS, ENCLOSURE_TYPES,
  ENCLOSURE_CONFIGURATIONS, SUBWOOFER_QUANTITIES, PORT_QUANTITIES,
  type EnclosureInputs,
} from '@adireaudio/enclosure-engine';
import { sanitizeCustomerEnclosureInputs } from '../customer-enclosure-boundary';
import { normalizeCustomerNotes } from '../customer-notes';
import { resolveTopLogoRequest } from '../top-logo-request';
import { dutyKeyFromEnclosureType, type SupportedSize } from '../subwoofer-presets';
import { lookupSupabasePriceRow, lookupPricingModifierConfig } from '../design-pricing';
import { cents, findPriceOption, verifyPriceOption } from './collective';
import { db } from './db';
import { DealerError } from './security';
import type { DealerQuote, DealerShop } from './types';

const enums: Record<string, readonly string[]> = {
  enclosureType: ENCLOSURE_TYPES, enclosureConfiguration: ENCLOSURE_CONFIGURATIONS,
  subwooferQuantity: SUBWOOFER_QUANTITIES, portQuantity: PORT_QUANTITIES,
  size: ['6.5"', '8"', '10"', '12"', '13.5"', '15"', '18"', '21"'],
  terminalPanel: ['Side Left', 'Back', 'None'], windowSize: ['12x12', '24x12'], windowOrientation: ['landscape', 'portrait'],
};
const numeric: Record<string, [number, number]> = {
  boxDepth: [0.1, 120], boxHeight: [0.1, 120], portWidth: [0.1, 40], tuningFrequency: [10, 100],
  netAirSpace: [0.01, 100], subDisplacement: [0, 10], subCutoutDiameter: [0.1, 30], outsideDiameter: [0.1, 35],
  terminalXOffset: [-120, 120], subwooferXOffset: [-120, 120], subwooferYOffset: [-120, 120],
  windowXOffset: [-120, 120], windowYOffset: [-120, 120],
};

/** Build a fresh allowlisted input object. Never store arbitrary browser manufacturing overrides. */
export function parseDesign(value: unknown): EnclosureInputs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DealerError('A design is required.', 422);
  const raw = value as Record<string, unknown>;
  const result: Record<string, unknown> = { ...DEFAULT_INPUTS };
  for (const [key, choices] of Object.entries(enums)) {
    if (raw[key] === undefined && !(key in DEFAULT_INPUTS)) continue;
    if (typeof raw[key] !== 'string' || !choices.includes(raw[key] as string)) throw new DealerError(`Invalid design option: ${key}`, 422);
    result[key] = raw[key];
  }
  for (const [key, [min, max]] of Object.entries(numeric)) {
    if (raw[key] === undefined && !(key in DEFAULT_INPUTS)) continue;
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || (raw[key] as number) < min || (raw[key] as number) > max) {
      throw new DealerError(`Invalid design measurement: ${key}`, 422);
    }
    result[key] = raw[key];
  }
  for (const key of ['recessedMounting', 'windowEnabled']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new DealerError(`Invalid design option: ${key}`, 422);
    result[key] = raw[key] === true;
  }
  for (const key of ['subwooferBrand', 'subwooferModel']) {
    if (raw[key] !== undefined && (typeof raw[key] !== 'string' || (raw[key] as string).length > 120)) throw new DealerError('Invalid subwoofer description.', 422);
    result[key] = raw[key] ?? '';
  }
  return sanitizeCustomerEnclosureInputs(result as unknown as EnclosureInputs);
}

export async function retailDesign(value: unknown) {
  const inputs = parseDesign(value);
  const calculations = calculateEnclosure(inputs);
  if (!Number.isFinite(calculations.boxWidth) || calculations.boxWidth <= 0 || calculations.boxWidth > 120) throw new DealerError('This enclosure needs a build review.', 422);
  if (calculations.baffleCheck.status === 'DOES NOT FIT') throw new DealerError('The selected subwoofer does not fit.', 422);
  if (inputs.enclosureConfiguration === 'Subs Up/Port Back') {
    const placement = checkSubwooferPlacement(inputs, calculations, generateCutList(inputs, calculations));
    if (!placement.safe) throw new DealerError(placement.conflict?.label ?? 'Choose a safe subwoofer position.', 422);
  }
  if (inputs.windowEnabled && !checkWindowPlacement(inputs, calculations, inputs.windowXOffset ?? 0, inputs.windowYOffset ?? 0, generateCutList(inputs, calculations)).safe) {
    throw new DealerError('Choose a safe acrylic window position.', 422);
  }
  const [row, modifiers] = await Promise.all([
    lookupSupabasePriceRow(inputs.size as SupportedSize, dutyKeyFromEnclosureType(inputs.enclosureType), inputs.netAirSpace, false),
    lookupPricingModifierConfig(),
  ]);
  if (!row) throw new DealerError('Pricing is unavailable for this design. Please contact the store.', 503);
  // Dealer shoppers always see retail MAP. Collective alone determines BHS's payment.
  const modified = resolveModifiedMAP({ designName: generateModelNumber(inputs), size: inputs.size.replace(/"/g, ''), baseMap: Number(row.map_price), modifiers, inputs: inputs as unknown as Record<string, unknown>, material: detectMaterial(inputs.enclosureType) });
  return { inputs, calculations, price: cents(modified.finalMap) / 100 };
}

export async function createCartQuote(shop: DealerShop, body: Record<string, unknown>) {
  if (typeof body.requestKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestKey)) throw new DealerError('A valid request reference is required.');
  const design = await retailDesign(body.inputs);
  const specs = body.designSpecs && typeof body.designSpecs === 'object' ? body.designSpecs as Record<string, unknown> : {};
  const logo = resolveTopLogoRequest(specs.topLogoSelection, specs.customLogoRequest, design.inputs.subwooferBrand);
  if (!logo.valid) throw new DealerError('Describe the custom logo you would like.', 422);
  const summary = `${design.inputs.subwooferQuantity} ${design.inputs.size} | ${design.inputs.enclosureType} | ${design.inputs.netAirSpace} cu ft | ${design.inputs.tuningFrequency} Hz`;
  const snapshot = {
    engineRevision: process.env.ENCLOSURE_ENGINE_REVISION, inputs: design.inputs,
    calculations: design.calculations, customerNotes: normalizeCustomerNotes(body.customerNotes), topLogo: logo, summary,
  };
  const option = await findPriceOption(shop, design.price);
  const variantId = await verifyPriceOption(shop, option);
  const fingerprint = createHash('sha256').update(JSON.stringify({ inputs: design.inputs, notes: snapshot.customerNotes, logo })).digest('hex');
  const quote = await db<DealerQuote>('rpc/bhs_dealer_reserve_quote', 'POST', { p_quote: {
    id: randomUUID(), shop: shop.shop, request_key: body.requestKey, fingerprint, retail_price: design.price,
    snapshot, option_id: option.id, variant_id: option.retailer_variant_id,
  } });
  // An idempotent retry may resolve an older price. Never silently substitute today's option.
  if (quote.variant_id !== option.retailer_variant_id || cents(quote.retail_price) !== cents(design.price)) {
    throw new DealerError('This saved quote has changed. Refresh the page to create a new quote.', 409);
  }
  return { quoteId: quote.id, price: design.price, currency: 'USD', item: { id: variantId, quantity: 1,
    properties: { 'BHS Design': quote.id, 'Enclosure': summary, '_bhs_design_id': quote.id } } };
}
