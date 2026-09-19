import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { signSession } from '../src/lib/dealer/security';
import { merchantShop, merchantDesign, listMerchantDesigns, getMerchantDesign } from '../src/lib/dealer/merchant-designs';
import type { DealerQuote } from '../src/lib/dealer/types';

const mocks = vi.hoisted(() => ({ db: vi.fn(), getQuote: vi.fn(), getShop: vi.fn() }));
vi.mock('../src/lib/dealer/db', () => mocks);
const shop = 'dealer.myshopify.com';
const id = '11111111-2222-4333-8444-555555555555';
const quote: DealerQuote = { id, shop, request_key: id, fingerprint: 'private', retail_price: 500, currency: 'USD', option_id: 'private', variant_id: 'private', created_at: '2026-09-19T12:00:00Z', snapshot: {
  inputs: { boxDepth: 18, windowEnabled: true, subwooferBrand: 'Brand', dealer_price: 1, manufacturingSecret: 'private' },
  customerNotes: 'Please confirm fit\nwith my dealer.', topLogo: { displayLabel: 'Custom request', customRequest: 'My logo', mode: 'custom', secret: 'private' },
  calculations: { cutList: 'private' }, engineRevision: 'private', summary: 'Custom enclosure',
} };

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('DEALER_SESSION_SECRET', 'merchant-test-secret-at-least-thirty-two-characters'); });
afterEach(() => vi.unstubAllEnvs());

describe('dealer merchant design access', () => {
  it('rejects missing, shopper, expired and tampered sessions before reading data', async () => {
    for (const token of [undefined, signSession('shopper', shop, 60), signSession('merchant', shop, -1), signSession('merchant', shop, 60) + 'x']) {
      await expect(merchantShop(token)).rejects.toThrow();
    }
    expect(mocks.getShop).not.toHaveBeenCalled();
  });
  it('rechecks the signed merchant store so uninstall revokes access', async () => {
    mocks.getShop.mockRejectedValue(new Error('Store uninstalled'));
    await expect(merchantShop(signSession('merchant', shop, 60))).rejects.toThrow('Store uninstalled');
    expect(mocks.getShop).toHaveBeenCalledWith(shop);
  });
  it('exposes customer notes and logo while excluding private snapshot fields', () => {
    const data = merchantDesign(quote);
    expect(data.customerNotes).toBe(quote.snapshot.customerNotes);
    expect(data.logo.customRequest).toBe('My logo');
    expect(data.selections).toContainEqual({ label: 'Depth (in)', value: '18' });
    expect(data.selections).toContainEqual({ label: 'Acrylic window', value: 'Yes' });
    expect(JSON.stringify(data)).not.toContain('private');
    expect(data).not.toHaveProperty('snapshot');
  });
  it('filters every list page to the authenticated store and limits returned rows', async () => {
    mocks.db.mockResolvedValue(Array.from({ length: 51 }, () => quote));
    const result = await listMerchantDesigns(shop, 2);
    expect(mocks.db).toHaveBeenCalledWith(expect.stringContaining(`shop=eq.${shop}&`));
    expect(mocks.db).toHaveBeenCalledWith(expect.stringContaining('limit=51&offset=50'));
    expect(result.designs).toHaveLength(50); expect(result.hasMore).toBe(true);
  });
  it('rejects invalid identifiers and pages without making database requests', async () => {
    await expect(getMerchantDesign(shop, 'id&shop=other')).rejects.toThrow();
    for (const page of [0, -1, 1.5, NaN, 2001]) await expect(listMerchantDesigns(shop, page)).rejects.toThrow();
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.getQuote).not.toHaveBeenCalled();
  });
  it('never returns a design owned by another store', async () => {
    mocks.getQuote.mockResolvedValue({ ...quote, shop: 'other.myshopify.com' });
    await expect(getMerchantDesign(shop, id)).rejects.toMatchObject({ status: 404 });
    expect(mocks.getQuote).toHaveBeenCalledWith(shop, id);
  });
  it('returns only the authenticated store’s requested design', async () => {
    mocks.getQuote.mockResolvedValue(quote);
    expect((await getMerchantDesign(shop, id)).id).toBe(id);
  });
});
