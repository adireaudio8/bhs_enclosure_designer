import { db } from '@/lib/dealer/db';
import { DealerError, equal, errorResponse, requiredEnv } from '@/lib/dealer/security';
import { lookupPricingModifierConfig, type PricingRow } from '@/lib/design-pricing';
import { planCollectiveCatalog } from '@/lib/dealer/catalog-plan';
import { noStore } from '@/lib/dealer/request';

/** BHS operator-only, read-only price-list preparation. No merchant or shopper token can call this. */
export async function GET(req: Request) {
  try {
    const key = requiredEnv('DEALER_OPERATOR_KEY');
    if (key.length < 32 || !equal(req.headers.get('authorization') ?? '', `Bearer ${key}`)) throw new DealerError('Operator access required.', 401);
    const rows: PricingRow[] = [];
    for (let offset = 0; offset < 100_000; offset += 500) {
      const page = await db<PricingRow[]>(`pricing?select=size,net_cubic_feet,map_price,dealer_price,build_type&order=size.asc,build_type.asc,net_cubic_feet.asc&limit=500&offset=${offset}`);
      rows.push(...page);
      if (page.length < 500) return noStore(planCollectiveCatalog(rows, await lookupPricingModifierConfig()));
    }
    throw new DealerError('Pricing catalog is too large to prepare safely.', 503);
  } catch (error) { return errorResponse(error); }
}
