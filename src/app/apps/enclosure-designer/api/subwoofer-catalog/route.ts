import { NextResponse } from 'next/server';
import { getAppProxyContext } from '@/lib/app-proxy';
import {
  buildCustomerLogoOptions,
  buildCustomerSubwooferCatalog,
  type BrandCatalogRow,
  type SubwooferCatalogRow,
} from '@/lib/subwoofer-catalog';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function readTable<T>(path: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
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
    const [brands, subwoofers] = await Promise.all([
      readTable<BrandCatalogRow>(
        'brands?select=name,code,model_codes,logo_path&order=name.asc',
      ),
      readTable<SubwooferCatalogRow>(
        'subwoofers?select=brand,model_name,model_code,diameter,displacement,cutout_diameter,outside_diameter,mounting_depth,is_retired&order=brand.asc,model_name.asc',
      ),
    ]);
    return NextResponse.json({
      brands: buildCustomerSubwooferCatalog(brands, subwoofers),
      logoOptions: buildCustomerLogoOptions(brands),
    });
  } catch (error) {
    console.error('[subwoofer-catalog] lookup failed', error);
    return NextResponse.json({ error: 'Subwoofer catalog is unavailable.' }, { status: 503 });
  }
}
