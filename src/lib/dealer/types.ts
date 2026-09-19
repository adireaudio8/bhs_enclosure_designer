export interface DealerShop {
  shop: string;
  name: string;
  storefront_url: string;
  currency: string;
  status: 'pending' | 'active' | 'suspended' | 'uninstalled';
  publication_id: string | null;
  collective_location_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  scopes: string;
  shipping_confirmed: boolean;
  collective_payments_confirmed: boolean;
  pilot_verified: boolean;
}

/** Registered only after checking a real Collective import. Never retailer-created products. */
export interface CollectivePriceOption {
  id: string;
  shop: string;
  supplier_variant_id: string;
  retailer_variant_id: string;
  sku: string;
  retail_price: number;
  currency: 'USD';
  enabled: boolean;
}

export interface DealerQuote {
  id: string;
  shop: string;
  request_key: string;
  fingerprint: string;
  retail_price: number;
  currency: 'USD';
  snapshot: Record<string, unknown>;
  option_id: string;
  variant_id: string;
  created_at: string;
}
