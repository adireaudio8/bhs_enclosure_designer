import { NextResponse } from 'next/server';
import type { EnclosureInputs } from '@adireaudio/enclosure-engine';
import { getAppProxyContext } from '@/lib/app-proxy';
import { shopifyAdminGraphQL } from '@/lib/shopify-admin';

export const runtime = 'nodejs';

interface DesignSpecs {
  brand?: string;
  model?: string;
  size: string;
  quantity: string;
  configuration: string;
  duty: 'SD' | 'RD' | 'HD';
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  internalVolume: number;
  tuningFreq: number;
  portArea: number;
  flushMount?: boolean;
  plexiWindow?: string;
}

interface CheckoutRequest {
  inputs: EnclosureInputs;
  designSpecs: DesignSpecs;
}

interface PricingResponse {
  price?: number;
  leadTimeDays?: number;
  tier?: string;
  error?: string;
}

function attr(key: string, value: unknown) {
  return {
    key,
    value: String(value ?? ''),
  };
}

function estimateShippingWeightPounds(specs: DesignSpecs) {
  const externalVolumeCuFt = (specs.boxWidth * specs.boxHeight * specs.boxDepth) / 1728;
  return Math.max(35, Math.round(externalVolumeCuFt * 32));
}

async function validatePrice(req: Request, inputs: EnclosureInputs) {
  const currentUrl = new URL(req.url);
  const pricingUrl = new URL('/apps/enclosure-designer/api/design-pricing', currentUrl.origin);
  pricingUrl.search = currentUrl.search;

  const res = await fetch(pricingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as PricingResponse;
  if (!res.ok) {
    throw new Error(data.error ?? `Pricing validation failed (${res.status})`);
  }

  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Pricing validation returned an invalid price.');
  }

  return {
    price,
    leadTimeDays: Number(data.leadTimeDays) || 21,
    tier: String(data.tier ?? 'guest'),
  };
}

export async function POST(req: Request) {
  const proxyContext = getAppProxyContext(req);
  if (!proxyContext.verified) {
    return NextResponse.json(
      { error: 'Invalid Shopify app proxy signature' },
      { status: 401 },
    );
  }

  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.inputs || !body.designSpecs) {
    return NextResponse.json(
      { error: 'Missing inputs or design specs.' },
      { status: 400 },
    );
  }

  let validated;
  try {
    validated = await validatePrice(req, body.inputs);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Price validation failed.' },
      { status: 422 },
    );
  }

  const specs = body.designSpecs;
  const designSummary = [
    `${specs.quantity} ${specs.size} custom enclosure`,
    specs.brand ? specs.brand : null,
    specs.model ? specs.model : null,
    specs.configuration,
    `${specs.internalVolume} cu ft`,
    `${specs.tuningFreq} Hz`,
  ]
    .filter(Boolean)
    .join(' | ');

  const lineAttributes = [
    attr('Subwoofer brand', specs.brand),
    attr('Subwoofer model', specs.model),
    attr('Subwoofer size', specs.size),
    attr('Subwoofer quantity', specs.quantity),
    attr('Configuration', specs.configuration),
    attr('Duty', specs.duty),
    attr('External width', `${specs.boxWidth}"`),
    attr('External height', `${specs.boxHeight}"`),
    attr('External depth', `${specs.boxDepth}"`),
    attr('Net airspace', `${specs.internalVolume} cu ft`),
    attr('Tuning', `${specs.tuningFreq} Hz`),
    attr('Port area', `${specs.portArea} sq in`),
    attr('Flush mount', specs.flushMount ? 'Yes' : 'No'),
    attr('Plexi window', specs.plexiWindow || 'None'),
    attr('Pricing tier', validated.tier),
  ];

  try {
    const data = await shopifyAdminGraphQL<{
      draftOrderCreate: {
        draftOrder: { id: string; name: string; invoiceUrl: string | null } | null;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(
      `#graphql
      mutation CreateDesignerDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        input: {
          note: `Custom enclosure designer request: ${designSummary}`,
          tags: ['custom-enclosure', 'enclosure-designer'],
          visibleToCustomer: true,
          acceptAutomaticDiscounts: false,
          allowDiscountCodesInCheckout: false,
          shippingLine: {
            title: 'Free Shipping',
            priceWithCurrency: {
              amount: '0.00',
              currencyCode: 'USD',
            },
          },
          lineItems: [
            {
              title: 'Custom Subwoofer Enclosure',
              sku: `CUSTOM-ENCLOSURE-${specs.duty}`,
              quantity: 1,
              requiresShipping: true,
              taxable: true,
              originalUnitPriceWithCurrency: {
                amount: validated.price.toFixed(2),
                currencyCode: 'USD',
              },
              weight: {
                value: estimateShippingWeightPounds(specs),
                unit: 'POUNDS',
              },
              customAttributes: lineAttributes,
            },
          ],
          customAttributes: [
            attr('Source', 'BHS enclosure designer'),
            attr('Design summary', designSummary),
            attr('Lead time days', validated.leadTimeDays),
            attr('App proxy customer ID', proxyContext.loggedInCustomerId),
          ],
        },
      },
    );

    const errors = data.draftOrderCreate.userErrors;
    if (errors.length) {
      return NextResponse.json(
        { error: errors.map((error) => error.message).join('; ') },
        { status: 422 },
      );
    }

    const draftOrder = data.draftOrderCreate.draftOrder;
    if (!draftOrder?.invoiceUrl) {
      return NextResponse.json(
        { error: 'Draft order was created without a checkout URL.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      checkoutUrl: draftOrder.invoiceUrl,
      price: validated.price,
    });
  } catch (err) {
    console.error('[designer-checkout] draft order creation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout service failed.' },
      { status: 502 },
    );
  }
}
