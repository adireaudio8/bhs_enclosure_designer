import { db, shopFilter } from './db';
import { DealerError } from './security';
import { adminGraphQL } from './shopify';
import type { CollectivePriceOption, DealerShop } from './types';

export const VARIANT_QUERY = `query DealerCollectiveVariant($id: ID!, $publication: ID!) {
  productVariant(id:$id) { id legacyResourceId sku price inventoryQuantity
    product { id status tags publishedOnPublication(publicationId:$publication) }
    inventoryItem { inventoryLevels(first:100) { nodes { location { id name isActive } } pageInfo { hasNextPage } } }
  }
}`;
export interface LiveVariant {
  id: string; legacyResourceId: string; sku: string | null; price: string; inventoryQuantity: number | null;
  product: { id: string; status: string; tags: string[]; publishedOnPublication: boolean };
  inventoryItem: { inventoryLevels: { nodes: { location: { id: string; name: string; isActive: boolean } }[]; pageInfo: { hasNextPage: boolean } } };
}
export function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw new DealerError('A valid price is required.', 422);
  return Math.round(n * 100);
}

export function assertCollectiveVariant(shop: DealerShop, option: CollectivePriceOption, variant: LiveVariant | null): string {
  // Tags alone are not proof: also require the exact pre-verified variant, SKU and Collective location.
  // No public API proves the current payment agreement; activation additionally requires an operator check.
  const locations = variant?.inventoryItem.inventoryLevels;
  if (!variant || option.shop !== shop.shop || !option.enabled || option.currency !== shop.currency ||
      variant.id !== option.retailer_variant_id || variant.sku !== option.sku || cents(variant.price) !== cents(option.retail_price) ||
      variant.product.status !== 'ACTIVE' || !variant.product.publishedOnPublication ||
      !variant.product.tags.includes('Shopify Collective') || locations?.pageInfo.hasNextPage ||
      !locations?.nodes.some(({ location }) => location.id === shop.collective_location_id && location.isActive) ||
      !(Number(variant.inventoryQuantity) > 0) || !/^\d+$/.test(String(variant.legacyResourceId))) {
    throw new DealerError('This custom enclosure option is not ready to order from this store. Please contact the store.', 409);
  }
  return String(variant.legacyResourceId);
}

export async function findPriceOption(shop: DealerShop, price: number): Promise<CollectivePriceOption> {
  const options = await db<CollectivePriceOption[]>(`bhs_dealer_price_options?${shopFilter(shop.shop)}&enabled=eq.true&currency=eq.USD&retail_price=eq.${(cents(price) / 100).toFixed(2)}&limit=2`);
  if (options.length !== 1) throw new DealerError('This configuration is not available for online ordering yet. Please contact the store for this design.', 409);
  return options[0];
}

export async function verifyPriceOption(shop: DealerShop, option: CollectivePriceOption): Promise<string> {
  const result = await adminGraphQL<{ productVariant: LiveVariant | null }>(shop.shop, VARIANT_QUERY, { id: option.retailer_variant_id, publication: shop.publication_id });
  return assertCollectiveVariant(shop, option, result.productVariant);
}
