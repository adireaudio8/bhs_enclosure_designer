import { NextResponse } from 'next/server';
import { getAppProxyContext } from '@/lib/app-proxy';
import {
  buildCustomerLogoChoices,
  buildCustomerSubwooferCatalog,
  type BrandCatalogRow,
  type SubwooferCatalogRow,
} from '@/lib/subwoofer-catalog';
import { SUPABASE_SERVER_KEY, supabaseServerHeaders } from '@/lib/supabase-server';
import { logoBrandKey, neverLogoBrandKeys, readNeverLogoBrandIds } from '@/lib/never-logo-brands';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = SUPABASE_SERVER_KEY;

async function readTable<T>(path: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseServerHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Catalog query failed (${response.status}).`);
  }
  return (await response.json()) as T[];
}

export async function GET(request: Request) {
  const proxyContext = getAppProxyContext(request);
  if (!proxyContext.verified) {
    return NextResponse.json({ error: 'Invalid Shopify app proxy signature' }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Subwoofer catalog is unavailable.' }, { status: 503 });
  }

  try {
    const [brands, subwoofers, neverLogoIds] = await Promise.all([
      readTable<BrandCatalogRow>(
        'brands?select=id,name,code,model_codes&order=name.asc',
      ),
      readTable<SubwooferCatalogRow>(
        'subwoofers?select=brand,model_name,model_code,diameter,displacement,cutout_diameter,outside_diameter,mounting_depth,is_retired&order=brand.asc,model_name.asc',
      ),
      // Brands marked "Never use this brand's logo" in the calculator. If the mark
      // cannot be read, no brand logo is offered (null below), rather than risk one.
      readNeverLogoBrandIds().catch((error) => {
        console.error('[subwoofer-catalog] never-use logo setting unreadable', error);
        return null;
      }),
    ]);
    const neverLogoKeys = neverLogoIds === null
      ? new Set(brands.map((brand) => logoBrandKey(brand.name)).filter(Boolean))
      : neverLogoBrandKeys(brands, neverLogoIds);
    return NextResponse.json({
      brands: buildCustomerSubwooferCatalog(brands, subwoofers),
      logoOptions: buildCustomerLogoChoices(brands, neverLogoKeys),
      // Brands whose logo is never shown or cut: "Match subwoofer brand" means no top logo for them.
      noLogoBrands: [...new Set(brands
        .map((brand) => String(brand.name ?? '').trim())
        .filter((name) => name && neverLogoKeys.has(logoBrandKey(name))))],
    });
  } catch (error) {
    console.error('[subwoofer-catalog] lookup failed', error);
    return NextResponse.json({ error: 'Subwoofer catalog is unavailable.' }, { status: 503 });
  }
}
