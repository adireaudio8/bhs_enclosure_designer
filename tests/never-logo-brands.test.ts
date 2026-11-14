import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('brands whose logo must never be used', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the stored list strictly: no row is no brand, an unreadable value is an error', async () => {
    const { parseNeverLogoBrandIds } = await import('../src/lib/never-logo-brands');
    expect(parseNeverLogoBrandIds(null)).toEqual([]);
    expect(parseNeverLogoBrandIds('')).toEqual([]);
    expect(parseNeverLogoBrandIds(JSON.stringify({ version: 1, brandIds: [A.toUpperCase(), A] }))).toEqual([A]);
    expect(() => parseNeverLogoBrandIds('{not json')).toThrow();
    expect(() => parseNeverLogoBrandIds(JSON.stringify({ version: 1, brandIds: ['not-a-uuid'] }))).toThrow();
    expect(() => parseNeverLogoBrandIds(JSON.stringify({ version: 1 }))).toThrow();
  });

  it('turns the marked brand ids into brand names', async () => {
    const { neverLogoBrandKeys } = await import('../src/lib/never-logo-brands');
    const keys = neverLogoBrandKeys([{ id: A, name: 'Protective Brand' }, { id: B, name: 'Sundown Audio' }], [A]);
    expect([...keys]).toEqual(['protective brand']);
  });

  it('reads the setting and the brand names from the database', async () => {
    const { readNeverLogoBrandKeys } = await import('../src/lib/never-logo-brands');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/app_settings?')) {
        expect(url).toContain('key=eq.logo_never_brands');
        return new Response(JSON.stringify([{ value: JSON.stringify({ version: 1, brandIds: [A] }) }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: A, name: 'Protective Brand' }, { id: B, name: 'Sundown Audio' }]), { status: 200 });
    });
    const keys = await readNeverLogoBrandKeys(fetchMock as unknown as typeof fetch);
    expect([...keys]).toEqual(['protective brand']);
  });

  it('treats no setting row as no marked brand', async () => {
    const { readNeverLogoBrandKeys } = await import('../src/lib/never-logo-brands');
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    expect([...(await readNeverLogoBrandKeys(fetchMock as unknown as typeof fetch))]).toEqual([]);
  });

  it('fails when the setting cannot be read, so callers withhold brand logos', async () => {
    const { readNeverLogoBrandKeys, readNeverLogoBrandIds } = await import('../src/lib/never-logo-brands');
    const failing = vi.fn(async () => new Response('nope', { status: 500 }));
    await expect(readNeverLogoBrandIds(failing as unknown as typeof fetch)).rejects.toThrow();
    await expect(readNeverLogoBrandKeys(failing as unknown as typeof fetch)).rejects.toThrow();
  });
});
