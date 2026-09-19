import { DEFAULT_INPUTS, ENCLOSURE_CONFIGURATIONS, SUBWOOFER_QUANTITIES, PORT_QUANTITIES, generateModelNumber, resolveModifiedMAP, type EnclosureInputs, type PricingModifiersConfig } from '@adireaudio/enclosure-engine';
import type { PricingRow } from '../design-pricing';
import { cents } from './collective';

/** Offline planning only: no product, price-list, inventory or payment writes. */
export function planCollectiveCatalog(rows: PricingRow[], modifiers: PricingModifiersConfig) {
  const prices = new Set<number>();
  for (const row of rows) {
    if (!['SD', 'RD', 'HD'].includes(row.build_type)) continue;
    const size = String(row.size).replace(/["”]/g, '').trim();
    if (!['6.5', '8', '10', '12', '13.5', '15', '18', '21'].includes(size)) continue;
    const duty = ({ SD: 'Standard', RD: 'Regular', HD: 'Heavy' } as Record<string, string>)[row.build_type];
    for (const material of ['birch', 'mdf'] as const) for (const configuration of ENCLOSURE_CONFIGURATIONS)
      for (const quantity of SUBWOOFER_QUANTITIES) for (const ports of PORT_QUANTITIES)
        for (const recessed of [false, true]) for (const window of [null, '12x12', '24x12'] as const) {
          const inputs: EnclosureInputs = { ...DEFAULT_INPUTS, size: `${size}"` as EnclosureInputs['size'],
            netAirSpace: Number(row.net_cubic_feet), enclosureType: `${material === 'birch' ? 'Birch Ply' : 'MDF'} - ${duty} Duty` as EnclosureInputs['enclosureType'],
            enclosureConfiguration: configuration, subwooferQuantity: quantity, portQuantity: ports,
            recessedMounting: recessed, windowEnabled: !!window, windowSize: window ?? undefined };
          const result = resolveModifiedMAP({ designName: generateModelNumber(inputs), size, baseMap: Number(row.map_price), modifiers,
            inputs: inputs as unknown as Record<string, unknown>, material });
          prices.add(cents(result.finalMap));
        }
  }
  const options = [...prices].sort((a, b) => a - b).map((price, i) => ({
    sku: `BHS-CUSTOM-USD-${price}`, retail_price: (price / 100).toFixed(2), currency: 'USD',
    product_group: Math.floor(i / 100) + 1,
  }));
  return { generatedAt: new Date().toISOString(), maxVariantsPerProduct: 100, options,
    note: 'Candidate prices only. Verify catalog-specific modifier rules, shipping, actual Collective cost and imports before activation. Never change an existing price SKU to represent a different price.' };
}
