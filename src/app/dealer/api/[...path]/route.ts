import { shopper, noStore } from '@/lib/dealer/request';
import { DealerError, errorResponse, readJson } from '@/lib/dealer/security';
import { createCartQuote, retailDesign } from '@/lib/dealer/design';
import { findPriceOption, verifyPriceOption } from '@/lib/dealer/collective';
import { db } from '@/lib/dealer/db';
import { buildCustomerLogoChoices, buildCustomerSubwooferCatalog, type BrandCatalogRow, type SubwooferCatalogRow } from '@/lib/subwoofer-catalog';
import { GET as brandLogo } from '@/app/apps/enclosure-designer/api/brand-logo/[brand]/route';

export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };

async function tablePages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const page = await db<T[]>(`${path}&limit=500&offset=${offset}`);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new DealerError('Catalog is too large to load safely.', 503);
}

export async function GET(req: Request, context: Context) {
  try {
    const shop = await shopper(req);
    const { path } = await context.params;
    if (path.join('/') === 'session') return noStore({ name: shop.name, origins: [new URL(shop.storefront_url).origin, `https://${shop.shop}`] });
    if (path.join('/') === 'subwoofer-catalog') {
      const [brands, subs] = await Promise.all([
        tablePages<BrandCatalogRow>('brands?select=name,code,model_codes&order=name.asc'),
        tablePages<SubwooferCatalogRow>('subwoofers?select=brand,model_name,model_code,diameter,displacement,cutout_diameter,outside_diameter,mounting_depth,is_retired&order=brand.asc,model_name.asc,id.asc'),
      ]);
      return noStore({ brands: buildCustomerSubwooferCatalog(brands, subs), logoOptions: buildCustomerLogoChoices(brands) });
    }
    if (path.length === 2 && path[0] === 'brand-logo') return brandLogo(req, { params: Promise.resolve({ brand: encodeURIComponent(path[1]) }) });
    throw new DealerError('Page not found.', 404);
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request, context: Context) {
  try {
    const shop = await shopper(req);
    const { path } = await context.params;
    const body = await readJson(req);
    if (path.join('/') === 'design-pricing') {
      const design = await retailDesign(body);
      const option = await findPriceOption(shop, design.price);
      await verifyPriceOption(shop, option);
      return noStore({ price: design.price, baffleStatus: design.calculations.baffleCheck.status, tier: 'guest' });
    }
    if (path.join('/') === 'checkout') return noStore(await createCartQuote(shop, body));
    throw new DealerError('Page not found.', 404);
  } catch (error) { return errorResponse(error); }
}
