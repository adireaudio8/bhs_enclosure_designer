import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

describe('dealer PostgreSQL migration and concurrency guards', () => {
  let pg: PGlite;
  const shop = 'dealer.myshopify.com';
  const option = randomUUID();
  const quote = { id: randomUUID(), shop, request_key: randomUUID(), fingerprint: 'immutable-design', retail_price: 500,
    snapshot: { notes: 'original' }, option_id: option, variant_id: 'retailer-variant' };
  beforeAll(async () => {
    pg = await PGlite.create();
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await pg.exec(readFileSync(new URL('../sql/20260919_dealer_designer.sql', import.meta.url), 'utf8'));
    await pg.query('insert into bhs_dealer_shops(shop) values($1),($2)', [shop, 'other.myshopify.com']);
    await pg.query('insert into bhs_dealer_price_options(id,shop,supplier_variant_id,retailer_variant_id,sku,retail_price,currency,enabled) values($1,$2,$3,$4,$5,500,\'USD\',true)', [option, shop, 'supplier-variant', 'retailer-variant', 'BHS-CUSTOM-USD-50000']);
  }, 30000);
  afterAll(async () => { await pg?.close(); });

  it('saves an immutable quote once and rejects reuse for a different design', async () => {
    const first = await pg.query<{ saved: { id: string; snapshot: { notes: string } } }>('select bhs_dealer_reserve_quote($1::jsonb) as saved', [quote]);
    const second = await pg.query<{ saved: { id: string; snapshot: { notes: string } } }>('select bhs_dealer_reserve_quote($1::jsonb) as saved', [{ ...quote, id: randomUUID(), snapshot: { notes: 'should not overwrite' } }]);
    expect(first.rows[0].saved.id).toBe(second.rows[0].saved.id);
    expect(second.rows[0].saved.snapshot.notes).toBe('original');
    await expect(pg.query('select bhs_dealer_reserve_quote($1::jsonb)', [{ ...quote, fingerprint: 'changed' }])).rejects.toThrow(/Idempotency/);
  });
  it('refuses another store’s price option', async () => {
    await expect(pg.query('select bhs_dealer_reserve_quote($1::jsonb)', [{ ...quote, id: randomUUID(), request_key: randomUUID(), shop: 'other.myshopify.com' }])).rejects.toThrow(/Price option/);
  });
  it('denies browser roles access to credentials and private design records', async () => {
    const result = await pg.query<{ table_access: boolean; function_access: boolean }>(`select
      has_table_privilege('anon','bhs_dealer_shops','SELECT') as table_access,
      has_function_privilege('authenticated','bhs_dealer_reserve_quote(jsonb)','EXECUTE') as function_access`);
    expect(result.rows[0]).toEqual({ table_access: false, function_access: false });
  });
  it('does not restore paid state after a newer cancellation, and does not duplicate lines', async () => {
    const line = { shop, order_id: 'order-1', line_id: 'line-1', order_name: '#1001', quote_id: quote.id, quantity: 1, status: 'awaiting_collective', reason: null };
    const save = (date: string, status: string) => pg.query('select bhs_dealer_record_order($1,$2,$3::timestamptz,$4::jsonb)', [shop, 'order-1', date, [{ ...line, status }]]);
    await save('2026-09-19T12:00:00Z', 'awaiting_collective');
    await save('2026-09-19T12:02:00Z', 'cancelled');
    await save('2026-09-19T12:01:00Z', 'awaiting_collective');
    const current = await pg.query<{ status: string }>('select status from bhs_dealer_order_lines where shop=$1 and order_id=$2', [shop, 'order-1']);
    expect(current.rows).toEqual([{ status: 'cancelled' }]);
  });
  it('rejects cross-store design links when recording an order', async () => {
    const line = { shop: 'other.myshopify.com', order_id: 'order-2', line_id: 'line-2', order_name: '#1002', quote_id: quote.id, quantity: 1, status: 'awaiting_collective' };
    await expect(pg.query('select bhs_dealer_record_order($1,$2,$3::timestamptz,$4::jsonb)', [line.shop, line.order_id, '2026-09-19T12:03:00Z', [line]])).rejects.toThrow(/Quote tenant/);
  });
  it('marks a removed custom line for review instead of leaving it ready', async () => {
    await pg.query('select bhs_dealer_record_order($1,$2,$3::timestamptz,$4::jsonb)', [shop, 'order-1', '2026-09-19T12:04:00Z', []]);
    const result = await pg.query<{ status: string; reason: string }>('select status,reason from bhs_dealer_order_lines where order_id=$1', ['order-1']);
    expect(result.rows[0]).toEqual({ status: 'needs_review', reason: 'Custom line removed or changed' });
  });
});
