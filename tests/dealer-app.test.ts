import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { DEFAULT_INPUTS, DEFAULT_PRICING_MODIFIERS } from '@adireaudio/enclosure-engine';
import { canonicalShop, decrypt, encrypt, hmac, readSession, signSession, verifyShopifyQuery, verifyWebhook } from '../src/lib/dealer/security';
import { assertActive } from '../src/lib/dealer/db';
import { assertCollectiveVariant, type LiveVariant } from '../src/lib/dealer/collective';
import { parseDesign } from '../src/lib/dealer/design';
import { assessOrderLine, type OrderLine } from '../src/lib/dealer/orders';
import { renderDealerProxy } from '../src/lib/dealer/proxy-wrapper';
import { planCollectiveCatalog } from '../src/lib/dealer/catalog-plan';
import type { CollectivePriceOption, DealerQuote, DealerShop } from '../src/lib/dealer/types';

const shop: DealerShop = { shop: 'dealer.myshopify.com', name: 'Dealer', storefront_url: 'https://dealer.example', currency: 'USD', status: 'active', publication_id: 'pub', collective_location_id: 'collective', access_token: null, refresh_token: null, access_expires_at: null, refresh_expires_at: null, scopes: '', shipping_confirmed: true, collective_payments_confirmed: true, pilot_verified: true };
const option: CollectivePriceOption = { id: 'option', shop: shop.shop, supplier_variant_id: 'supplier-variant', retailer_variant_id: 'variant', sku: 'BHS-CUSTOM-USD-50000', retail_price: 500, currency: 'USD', enabled: true };
const variant: LiveVariant = { id: 'variant', legacyResourceId: '1234', sku: option.sku, price: '500.00', inventoryQuantity: 50, product: { id: 'product', status: 'ACTIVE', tags: ['Shopify Collective'], publishedOnPublication: true }, inventoryItem: { inventoryLevels: { nodes: [{ location: { id: 'collective', name: 'BHS via Shopify Collective', isActive: true } }], pageInfo: { hasNextPage: false } } } };
const inputs = { ...DEFAULT_INPUTS, boxDepth: 18, boxHeight: 16, portWidth: 1.75, tuningFrequency: 32, netAirSpace: 2, subDisplacement: 0.15, subCutoutDiameter: 11.19, outsideDiameter: 12.81 };

beforeEach(() => {
  vi.stubEnv('DEALER_SHOPIFY_API_SECRET', 'shopify-secret');
  vi.stubEnv('DEALER_SESSION_SECRET', 'a-long-random-test-secret-of-at-least-32-chars');
  vi.stubEnv('DEALER_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('dealer authorization', () => {
  it.each(['https://dealer.myshopify.com', 'dealer.myshopify.com.evil.example', 'dealer.myshopify.com@evil.example', 'localhost', 'dealer/myshopify.com'])('rejects a non-Shopify tenant %s', value => expect(() => canonicalShop(value)).toThrow());
  it('normalizes a legitimate tenant', () => expect(canonicalShop('DEALER.myshopify.com')).toBe(shop.shop));
  it('binds encrypted credentials to their shop and token type', () => {
    const cipher = encrypt('secret-token', `${shop.shop}:access`);
    expect(decrypt(cipher, `${shop.shop}:access`)).toBe('secret-token');
    expect(() => decrypt(cipher, 'other.myshopify.com:access')).toThrow();
    expect(() => decrypt(cipher, `${shop.shop}:refresh`)).toThrow();
  });
  it('rejects tampered, expired and wrong-purpose sessions', () => {
    const token = signSession('shopper', shop.shop, 60);
    expect(readSession(token, 'shopper').shop).toBe(shop.shop);
    expect(() => readSession(token, 'merchant')).toThrow();
    expect(() => readSession(token + 'x', 'shopper')).toThrow();
    expect(() => readSession(signSession('shopper', shop.shop, -1), 'shopper')).toThrow();
  });
  it('verifies Shopify proxy HMAC including repeated parameters and rejects stale requests', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = new URL(`https://app.example/dealer/proxy?extra=1&extra=2&shop=${shop.shop}&timestamp=${timestamp}`);
    url.searchParams.set('signature', hmac(`extra=1,2shop=${shop.shop}timestamp=${timestamp}`, 'shopify-secret'));
    expect(verifyShopifyQuery(url, true)).toBe(shop.shop);
    expect(() => verifyShopifyQuery(url, true, Date.now() + 400_000)).toThrow();
    url.searchParams.append('shop', shop.shop);
    expect(() => verifyShopifyQuery(url, true)).toThrow();
  });
  it('verifies raw webhook bytes, not reparsed JSON', () => {
    const body = '{"id":1}'; const signature = hmac(body, 'shopify-secret', 'base64');
    expect(() => verifyWebhook(body, signature)).not.toThrow();
    expect(() => verifyWebhook('{ "id":1}', signature)).toThrow();
  });
  it.each(['shipping_confirmed', 'collective_payments_confirmed', 'pilot_verified'] as const)('keeps ordering disabled until %s', key => {
    expect(() => assertActive({ ...shop, [key]: false })).toThrow();
  });
});

describe('Collective product boundary', () => {
  it('accepts an exact registered Collective option', () => expect(assertCollectiveVariant(shop, option, variant)).toBe('1234'));
  it.each([
    { price: '499.99' }, { price: '0' }, { sku: 'another-product' }, { id: 'other-variant' }, { inventoryQuantity: 0 },
    { product: { ...variant.product, tags: [] } }, { product: { ...variant.product, status: 'DRAFT' } },
    { product: { ...variant.product, publishedOnPublication: false } },
    { inventoryItem: { inventoryLevels: { nodes: [], pageInfo: { hasNextPage: false } } } },
  ])('rejects stale or disconnected product %j', change => expect(() => assertCollectiveVariant(shop, option, { ...variant, ...change })).toThrow());
  it('never uses another dealer’s variant mapping', () => expect(() => assertCollectiveVariant({ ...shop, shop: 'other.myshopify.com' }, option, variant)).toThrow());
  it('rejects a disabled option', () => expect(() => assertCollectiveVariant(shop, { ...option, enabled: false }, variant)).toThrow());
});

describe('saved design and price boundary', () => {
  it('retains customer options while stripping manufacturing and price overrides', () => {
    const parsed = parseDesign({ ...inputs, forceLabyrinthPort: true, assemblyMethod: 'Flat Pack', price: 1, windowCustomWidth: 99 });
    expect(parsed.assemblyMethod).toBe('Press Together'); expect(parsed.forceLabyrinthPort).toBe(false);
    expect(parsed).not.toHaveProperty('price'); expect(parsed.windowCustomWidth).toBeUndefined();
  });
  it.each([{ netAirSpace: -1 }, { boxDepth: Infinity }, { boxHeight: '16' }, { enclosureType: 'unknown' }, { windowEnabled: 'false' }])('rejects malformed input %j', change => expect(() => parseDesign({ ...inputs, ...change })).toThrow());
  it('plans fixed price options in groups of no more than 100 with no wholesale estimate', () => {
    const result = planCollectiveCatalog(Array.from({ length: 80 }, (_, i) => ({ size: '12', build_type: 'RD', net_cubic_feet: i + 1, map_price: 400 + i * 2.37, dealer_price: 1 })), DEFAULT_PRICING_MODIFIERS);
    expect(result.options.length).toBeGreaterThan(100);
    expect(new Set(result.options.map(x => x.sku)).size).toBe(result.options.length);
    for (const group of new Set(result.options.map(x => x.product_group))) expect(result.options.filter(x => x.product_group === group).length).toBeLessThanOrEqual(100);
    expect(result.options[0]).not.toHaveProperty('dealer_price');
  });
});

describe('order reconciliation', () => {
  const quote = { id: 'design-1', shop: shop.shop, variant_id: 'variant', retail_price: 500, currency: 'USD' } as DealerQuote;
  const line: OrderLine = { id: 'line', quantity: 1, currentQuantity: 1, variant: { id: 'variant', sku: option.sku }, originalUnitPriceSet: { shopMoney: { amount: '500.00', currencyCode: 'USD' } }, customAttributes: [{ key: 'BHS Design', value: 'design-1' }, { key: '_bhs_design_id', value: 'design-1' }] };
  it('matches the immutable saved design', () => expect(assessOrderLine(shop.shop, line, quote)).toBeNull());
  it('holds missing designs, forged references and mismatched products', () => {
    expect(assessOrderLine(shop.shop, line, null)).toMatch(/Missing/);
    expect(assessOrderLine('other.myshopify.com', line, quote)).toMatch(/Missing/);
    expect(assessOrderLine(shop.shop, { ...line, customAttributes: [] }, quote)).toMatch(/reference/);
    expect(assessOrderLine(shop.shop, { ...line, variant: { id: 'cheaper', sku: '' } }, quote)).toMatch(/match/);
    expect(assessOrderLine(shop.shop, { ...line, originalUnitPriceSet: { shopMoney: { amount: '1', currencyCode: 'USD' } } }, quote)).toMatch(/price/);
  });
});

describe('regular cart bridge', () => {
  async function bridge(existing = false) {
    const html = renderDealerProxy('https://app.example', 'token', '/en-us/');
    const source = html.match(/<script>([\s\S]*)<\/script>/)![1];
    let listener: (event: unknown) => Promise<void>;
    const contentWindow = { postMessage: vi.fn() };
    const frame = { contentWindow, style: {}, src: '' };
    const parent = { postMessage: vi.fn() };
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ currency: 'USD', items: existing ? [{ variant_id: 1234, properties: { 'BHS Design': 'design-1' } }] : [{ variant_id: 555, properties: {} }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const location = { origin: 'https://dealer.example', assign: vi.fn() };
    runInNewContext(source, { URLSearchParams, location, parent, document: { getElementById: () => frame }, window: { addEventListener: (_type: string, fn: typeof listener) => { listener = fn; } }, fetch });
    const message = { source: contentWindow, origin: 'https://app.example', data: { type: 'bhs:dealer-add', requestId: 'request', item: { id: '1234', quantity: 1, properties: { 'BHS Design': 'design-1' } } } };
    return { listener: listener!, message, fetch, parent, frame };
  }
  it('adds an enclosure to the existing cart without clearing other products', async () => {
    const b = await bridge(); await b.listener(b.message);
    expect(b.fetch.mock.calls.map(x => x[0])).toEqual(['/en-us/cart.js', '/en-us/cart/add.js']);
    expect(JSON.parse(b.fetch.mock.calls[1][1].body).items).toHaveLength(1);
    expect(b.parent.postMessage).toHaveBeenCalledWith({ type: 'bhs:dealer-cart', path: '/en-us/cart' }, 'https://dealer.example');
  });
  it('does not add the same saved design twice after a retry', async () => {
    const b = await bridge(true); await b.listener(b.message); expect(b.fetch).toHaveBeenCalledTimes(1);
  });
  it('ignores messages from another origin or frame', async () => {
    const b = await bridge(); await b.listener({ ...b.message, origin: 'https://evil.example' });
    await b.listener({ ...b.message, source: {} }); expect(b.fetch).not.toHaveBeenCalled();
  });
});
