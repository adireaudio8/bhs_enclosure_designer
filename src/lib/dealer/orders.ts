import { cents } from './collective';
import { db, getQuote, shopFilter } from './db';
import { adminGraphQL } from './shopify';
import { DealerError } from './security';
import type { CollectivePriceOption, DealerQuote } from './types';

export const ORDER_QUERY = `query DealerOrder($id: ID!, $after: String) {
  order(id:$id) { id name updatedAt cancelledAt displayFinancialStatus currencyCode
    lineItems(first:100,after:$after) { nodes { id quantity currentQuantity customAttributes { key value }
      originalUnitPriceSet { shopMoney { amount currencyCode } } variant { id sku } }
      pageInfo { hasNextPage endCursor } }
  }
}`;
export interface OrderLine {
  id: string; quantity: number; currentQuantity: number;
  customAttributes: { key: string; value: string }[];
  originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  variant: { id: string; sku: string | null } | null;
}
interface OrderPage {
  id: string; name: string; updatedAt: string; cancelledAt: string | null; displayFinancialStatus: string; currencyCode: string;
  lineItems: { nodes: OrderLine[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
}

export function assessOrderLine(shop: string, line: OrderLine, quote: DealerQuote | null): string | null {
  if (!quote || quote.shop !== shop) return 'Missing saved design for this store';
  if (!line.variant || quote.variant_id !== line.variant.id) return 'The design does not match the ordered product';
  try {
    if (line.originalUnitPriceSet.shopMoney.currencyCode !== quote.currency || cents(line.originalUnitPriceSet.shopMoney.amount) !== cents(quote.retail_price)) return 'The ordered price differs from the saved quote';
  } catch { return 'The ordered price is invalid'; }
  const references = line.customAttributes.filter(a => a.key === 'BHS Design' || a.key === '_bhs_design_id');
  if (references.length !== 2 || references.some(a => a.value !== quote.id)) return 'The design reference was changed or removed';
  if (!Number.isInteger(line.currentQuantity) || line.currentQuantity < 1) return 'No remaining quantity';
  return null;
}

export async function reconcileDealerOrder(shop: string, orderId: string) {
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(orderId)) throw new DealerError('Invalid order reference.');
  let after: string | null = null;
  const lines: OrderLine[] = [];
  let order: OrderPage | null = null;
  let version: string | null = null;
  do {
    const result: { order: OrderPage | null } = await adminGraphQL(shop, ORDER_QUERY, { id: orderId, after });
    if (!result.order) throw new DealerError('Order not found on the connected store.', 404);
    order = result.order;
    if (version && version !== order.updatedAt) throw new DealerError('Order changed while it was being read. Retry this notification.', 503);
    version = order.updatedAt;
    lines.push(...order.lineItems.nodes);
    if (order.lineItems.pageInfo.hasNextPage && (!order.lineItems.pageInfo.endCursor || order.lineItems.pageInfo.endCursor === after)) throw new DealerError('Unable to finish reading the order.', 503);
    after = order.lineItems.pageInfo.hasNextPage ? order.lineItems.pageInfo.endCursor : null;
  } while (after);
  // Fetch current Shopify state on every notification: delayed webhooks cannot restore an old paid state.
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    if (offset >= 100_000) throw new DealerError('Unable to finish reading product mappings.', 503);
    const options = await db<CollectivePriceOption[]>(`bhs_dealer_price_options?${shopFilter(shop)}&select=retailer_variant_id&order=id.asc&limit=500&offset=${offset}`);
    options.forEach(x => ids.add(x.retailer_variant_id));
    if (options.length < 500) break;
  }
  const records = [];
  for (const line of lines) {
    const id = line.customAttributes.find(a => a.key === '_bhs_design_id')?.value;
    if (!ids.has(line.variant?.id ?? '') && !id) continue;
    const quote = id && /^[a-f0-9-]{36}$/i.test(id) ? await getQuote(shop, id) : null;
    const reason = assessOrderLine(shop, line, quote);
    const status = order!.cancelledAt ? 'cancelled' : order!.displayFinancialStatus === 'REFUNDED' || line.currentQuantity === 0 ? 'refunded'
      : reason || order!.displayFinancialStatus !== 'PAID' ? 'needs_review' : 'awaiting_collective';
    records.push({
      shop, order_id: order!.id, order_name: order!.name, line_id: line.id, quote_id: quote?.id ?? null,
      quantity: line.currentQuantity, status, reason: reason ?? (status === 'needs_review' ? 'Payment or refund requires review' : null), updated_at: new Date().toISOString(),
    });
  }
  await db('rpc/bhs_dealer_record_order', 'POST', { p_shop: shop, p_order_id: orderId, p_version: version, p_lines: records });
}
