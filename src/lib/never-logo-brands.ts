/**
 * Brands marked "Never use this brand's logo" in the calculator's Manage Logos.
 * Some brands do not allow their logo to be used at all, so the customer
 * designer must never offer, preview or order it.
 *
 * The calculator stores the marks in one app_settings row (no database column):
 *   key    logo_never_brands
 *   value  {"version":1,"brandIds":["<brand uuid>", ...]}
 * No row means no brand is marked. A row that cannot be understood is an error:
 * "unreadable" must never be treated as "no brand is marked".
 *
 * Logo choices name a brand by its display name (the brands table's `name`),
 * so the marks are matched by name, ignoring case and outer spaces.
 */
import { SUPABASE_SERVER_KEY, supabaseServerHeaders } from './supabase-server';

export const NEVER_LOGO_SETTING_KEY = 'logo_never_brands';

const BRAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The key a brand name is compared by. */
export function logoBrandKey(name: unknown): string {
  return String(name ?? '').trim().toLowerCase();
}

/** Brand ids from the stored value. Throws when the value cannot be understood. */
export function parseNeverLogoBrandIds(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new Error('The never-use logo setting is not text.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('The never-use logo setting is not valid JSON.');
  }
  const ids = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as { brandIds?: unknown }).brandIds
    : undefined;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && BRAND_ID.test(id))) {
    throw new Error('The never-use logo setting does not hold a list of brand ids.');
  }
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

/** The display names (as keys) of the marked brands. */
export function neverLogoBrandKeys(
  brands: ReadonlyArray<{ id?: unknown; name?: unknown }>,
  brandIds: ReadonlyArray<string>,
): Set<string> {
  const ids = new Set(brandIds.map((id) => id.toLowerCase()));
  const keys = new Set<string>();
  for (const brand of brands) {
    const key = logoBrandKey(brand.name);
    if (key && typeof brand.id === 'string' && ids.has(brand.id.toLowerCase())) keys.add(key);
  }
  return keys;
}

/** Reads the setting row; throws on any failure. */
export async function readNeverLogoBrandIds(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url || !SUPABASE_SERVER_KEY) throw new Error('Supabase env vars not set');
  const response = await fetchImpl(
    `${url}/rest/v1/app_settings?key=eq.${NEVER_LOGO_SETTING_KEY}&select=value&limit=1`,
    { headers: supabaseServerHeaders(), cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`Never-use logo setting lookup failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Never-use logo setting lookup returned no list.');
  const row = rows[0] as { value?: unknown } | undefined;
  return row ? parseNeverLogoBrandIds(row.value) : [];
}

/** The marked brands' name keys, read fresh (setting and brand names); throws on any failure. */
export async function readNeverLogoBrandKeys(fetchImpl: typeof fetch = fetch): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url || !SUPABASE_SERVER_KEY) throw new Error('Supabase env vars not set');
  const [ids, brandsResponse] = await Promise.all([
    readNeverLogoBrandIds(fetchImpl),
    fetchImpl(`${url}/rest/v1/brands?select=id,name`, { headers: supabaseServerHeaders(), cache: 'no-store' }),
  ]);
  if (!ids.length) return new Set();
  if (!brandsResponse.ok) throw new Error(`Brand lookup failed (${brandsResponse.status}).`);
  const brands: unknown = await brandsResponse.json();
  if (!Array.isArray(brands)) throw new Error('Brand lookup returned no list.');
  return neverLogoBrandKeys(brands as Array<{ id?: unknown; name?: unknown }>, ids);
}
