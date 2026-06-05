/**
 * Thin analytics layer — fires events to GA4 (gtag) and Meta Pixel (fbq).
 *
 * Mirrors the analytics stack on bassheadsupply.com: Google Site Kit (GA4)
 * + Pixel Caffeine (Meta Pixel). Same event names + IDs both surfaces so
 * funnel data aggregates cleanly across the Shopify storefront and the
 * hosted designer.
 *
 * Gracefully no-ops when:
 *   - The corresponding script hasn't loaded yet (e.g. before consent)
 *   - The env var for the script's ID is unset
 *   - We're in SSR / server context (no window object)
 *
 * Customer designer funnel events (custom + standard):
 *   - `designer_view`              page mount (auto via PageView/page_view)
 *   - `designer_first_interaction` first form field change
 *   - `designer_price_calculated`  first time pricing API returns ok
 *   - `add_to_cart`                checkout button click (GA4 + Pixel std)
 *   - `initiate_checkout`          successful draft-order checkout redirect
 *
 * GA4 measurement ID and Meta Pixel ID come from these env vars (both are
 * NEXT_PUBLIC_ so they're inlined into the client bundle):
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID    e.g. "G-XXXXXXXXXX"
 *   NEXT_PUBLIC_FB_PIXEL_ID          e.g. "1234567890"
 *
 * Both are optional — leaving them unset disables the corresponding
 * tracker. The page still works, no errors thrown.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

/**
 * Send a custom event to whatever trackers are loaded. Skip silently if a
 * given tracker isn't installed — no point throwing in front-end code.
 */
export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === 'undefined') return;

  // Strip undefined values so we don't pollute the event payload
  const cleanParams: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) cleanParams[k] = v;
  }

  // GA4 — gtag('event', name, params)
  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', name, cleanParams);
    } catch {
      // gtag failures shouldn't break the page
    }
  }

  // Meta Pixel — fbq('trackCustom', name, params) for non-standard events
  // and fbq('track', name, params) for the standard ecommerce events
  // (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase).
  if (typeof window.fbq === 'function') {
    try {
      const standardPixelEvents = new Set([
        'PageView',
        'ViewContent',
        'AddToCart',
        'InitiateCheckout',
        'Purchase',
        'Lead',
        'CompleteRegistration',
      ]);
      const pixelMethod = standardPixelEvents.has(name) ? 'track' : 'trackCustom';
      window.fbq(pixelMethod, name, cleanParams);
    } catch {
      // pixel failures shouldn't break the page
    }
  }
}

/**
 * Convenience wrappers for the customer designer funnel — keeps event
 * names + payload shape consistent across the codebase. If you ever need
 * to add a new event type, prefer adding a helper here over scattering
 * `trackEvent('foo')` calls inline.
 */

export function trackDesignerView(meta: { brand?: string; size?: string }) {
  trackEvent('ViewContent', {
    content_category: 'custom-enclosure-designer',
    content_type: 'product',
    brand: meta.brand,
    size: meta.size,
  });
  trackEvent('designer_view', { brand: meta.brand, size: meta.size });
}

export function trackDesignerFirstInteraction(field: string) {
  trackEvent('designer_first_interaction', { field });
}

export function trackDesignerPriceCalculated(meta: {
  price: number;
  tier: string;
  size?: string;
  quantity?: string;
  duty?: string;
  volume?: number;
}) {
  trackEvent('designer_price_calculated', {
    value: meta.price,
    pricing_tier: meta.tier,
    size: meta.size,
    quantity: meta.quantity,
    duty: meta.duty,
    volume_cu_ft: meta.volume,
  });
}

export function trackDesignerAddToCart(meta: {
  price: number;
  size?: string;
  quantity?: string;
  duty?: string;
}) {
  // GA4 + Pixel both have a standard "AddToCart" event — using the
  // canonical name here so it shows up in their built-in funnel reports
  // alongside the rest of the storefront's checkout funnel events.
  trackEvent('AddToCart', {
    value: meta.price,
    currency: 'USD',
    content_category: 'custom-enclosure',
    content_name: `${meta.duty} ${meta.quantity} ${meta.size}`,
    size: meta.size,
    quantity: meta.quantity,
    duty: meta.duty,
  });
}

export function trackDesignerInitiateCheckout(meta: { price: number }) {
  trackEvent('InitiateCheckout', {
    value: meta.price,
    currency: 'USD',
    content_category: 'custom-enclosure',
  });
}
