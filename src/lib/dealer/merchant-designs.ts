import { db, getQuote, getShop } from './db';
import { canonicalShop, DealerError, readSession } from './security';
import type { DealerQuote } from './types';

/** A merchant session is required even for an inactive store's historical designs. */
export async function merchantShop(token: string | undefined) {
  if (!token) throw new DealerError('Open the app from your Shopify admin.', 401);
  const session = readSession(token, 'merchant');
  return getShop(session.shop);
}

const inputLabels: Record<string, string> = {
  subwooferBrand: 'Subwoofer brand', subwooferModel: 'Subwoofer model', size: 'Subwoofer size',
  subwooferQuantity: 'Subwoofer quantity', enclosureType: 'Material and duty', enclosureConfiguration: 'Configuration',
  netAirSpace: 'Net airspace (cu ft)', tuningFrequency: 'Tuning (Hz)', boxDepth: 'Depth (in)', boxHeight: 'Height (in)',
  portWidth: 'Port width (in)', portQuantity: 'Port quantity', subDisplacement: 'Subwoofer displacement (cu ft)',
  subCutoutDiameter: 'Cutout diameter (in)', outsideDiameter: 'Outside diameter (in)',
  recessedMounting: 'Recessed mounting', terminalPanel: 'Terminal panel', terminalXOffset: 'Terminal offset (in)',
  subwooferXOffset: 'Subwoofer horizontal offset (in)', subwooferYOffset: 'Subwoofer vertical offset (in)',
  windowEnabled: 'Acrylic window', windowSize: 'Window size', windowOrientation: 'Window orientation',
  windowXOffset: 'Window horizontal offset (in)', windowYOffset: 'Window vertical offset (in)',
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';

/** Explicit projection: never expose wholesale data, credentials, or manufacturing geometry. */
export function merchantDesign(quote: DealerQuote) {
  const snapshot = record(quote.snapshot);
  const inputs = record(snapshot.inputs);
  const logo = record(snapshot.topLogo);
  return {
    id: quote.id, retailPrice: Number(quote.retail_price), currency: quote.currency, createdAt: quote.created_at,
    summary: text(snapshot.summary), customerNotes: text(snapshot.customerNotes),
    logo: { selection: text(logo.displayLabel), customRequest: text(logo.customRequest), mode: text(logo.mode), name: text(logo.logoName) },
    selections: Object.entries(inputLabels).flatMap(([key, label]) => {
      const value = inputs[key];
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? [{ label, value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) }] : [];
    }),
  };
}

export async function listMerchantDesigns(shop: string, page: number) {
  canonicalShop(shop);
  if (!Number.isSafeInteger(page) || page < 1 || page > 2000) throw new DealerError('Invalid page.', 400);
  const rows = await db<DealerQuote[]>(`bhs_dealer_quotes?shop=eq.${encodeURIComponent(shop)}&select=id,retail_price,currency,created_at,snapshot&order=created_at.desc,id.desc&limit=51&offset=${(page - 1) * 50}`);
  return { designs: rows.slice(0, 50).map(merchantDesign), hasMore: rows.length > 50 };
}

export async function getMerchantDesign(shop: string, id: string) {
  canonicalShop(shop);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new DealerError('Design not found.', 404);
  const quote = await getQuote(shop, id);
  if (!quote || quote.shop !== shop) throw new DealerError('Design not found.', 404);
  return merchantDesign(quote);
}
