import { NextResponse } from 'next/server';
import {
  calculateEnclosure,
  checkSubwooferPlacement,
  generateCutList,
  resolveTerminalPanel,
  resolveWindowDimensions,
  resolveWindowPanel,
  type EnclosureInputs,
} from '@adireaudio/enclosure-engine';
import { getAppProxyContext } from '@/lib/app-proxy';
import {
  resolvePositiveOnlinePrice,
  sanitizeCustomerEnclosureInputs,
} from '@/lib/customer-enclosure-boundary';
import { getEnclosureEngineRevision } from '@/lib/enclosure-engine-provenance';
import { shopifyAdminGraphQL } from '@/lib/shopify-admin';
import { normalizeCustomerNotes } from '@/lib/customer-notes';

export const runtime = 'nodejs';

interface DesignSpecs {
  brand?: string;
  model?: string;
  modelName?: string;
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
  customerNotes?: unknown;
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

function round(value: unknown, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const multiplier = Math.pow(10, digits);
  return Math.round(number * multiplier) / multiplier;
}

function inch(value: unknown, digits = 2) {
  return `${round(value, digits)}"`;
}

function signedInch(value: unknown, digits = 3) {
  const rounded = round(value, digits);
  return `${rounded > 0 ? '+' : ''}${rounded}"`;
}

function yesNo(value: unknown) {
  return value ? 'Yes' : 'No';
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

  const price = resolvePositiveOnlinePrice(data.price);
  if (price === null) {
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

  // Keep the internal-only manual labyrinth override outside the customer
  // boundary. The engine can still activate the layout automatically when
  // the submitted geometry requires it.
  const inputs = sanitizeCustomerEnclosureInputs(body.inputs);
  const customerNotes = normalizeCustomerNotes(body.customerNotes);
  const engineRevision = getEnclosureEngineRevision();

  let validated;
  try {
    validated = await validatePrice(req, inputs);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Price validation failed.' },
      { status: 422 },
    );
  }

  const specs = {
    ...body.designSpecs,
    brand: String(inputs.subwooferBrand ?? body.designSpecs.brand ?? '').trim(),
    model: String(inputs.subwooferModel ?? body.designSpecs.model ?? '').trim(),
    modelName: String(body.designSpecs.modelName ?? '').trim().slice(0, 120),
  };
  let calculations;
  try {
    calculations = calculateEnclosure(inputs);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Build calculations failed.' },
      { status: 422 },
    );
  }

  if (calculations.baffleCheck.status === 'DOES NOT FIT') {
    return NextResponse.json(
      { error: 'The selected subwoofer does not fit on the baffle.' },
      { status: 422 },
    );
  }
  const subwooferPlacement = inputs.enclosureConfiguration === 'Subs Up/Port Back'
    ? checkSubwooferPlacement(inputs, calculations, generateCutList(inputs, calculations))
    : null;
  if (subwooferPlacement && !subwooferPlacement.safe) {
    return NextResponse.json(
      { error: subwooferPlacement.conflict?.label ?? 'The subwoofer position is outside the safe build area.' },
      { status: 422 },
    );
  }

  const estimatedWeightPounds = estimateShippingWeightPounds(specs);
  const terminalPanel = resolveTerminalPanel(inputs);
  const terminalCustomized =
    inputs.terminalPanel !== undefined || inputs.terminalXOffset !== undefined;
  const windowEnabled = !!inputs.windowEnabled;
  const windowPanel = windowEnabled ? resolveWindowPanel(inputs) : 'None';
  const windowDimensions = windowEnabled
    ? resolveWindowDimensions(inputs)
    : { plateW: 0, plateH: 0, cutoutW: 0, cutoutH: 0 };
  const windowSize = windowEnabled
    ? inputs.windowSize === 'custom'
      ? `${inch(inputs.windowCustomWidth)} x ${inch(inputs.windowCustomHeight)} custom`
      : `${inputs.windowSize ?? '12x12'} ${inputs.windowOrientation ?? 'landscape'}`
    : 'None';
  const labyrinthActive = calculations.labyrinthPort.active;
  const labyrinthFoldCount = labyrinthActive
    ? Math.max(0, calculations.labyrinthPort.panels.length - 1)
    : 0;

  const designSummary = [
    `${specs.quantity} ${specs.size} custom enclosure`,
    specs.brand ? specs.brand : null,
    specs.modelName
      ? `${specs.modelName}${specs.model ? ` (${specs.model})` : ''}`
      : specs.model || null,
    specs.configuration,
    `${specs.internalVolume} cu ft`,
    `${specs.tuningFreq} Hz`,
  ]
    .filter(Boolean)
    .join(' | ');

  const productionDetails = [
    `Production build details`,
    `Engine revision: ${engineRevision}`,
    `Brand/model: ${specs.brand || 'Not specified'} ${specs.modelName || specs.model || ''}${specs.modelName && specs.model ? ` (${specs.model})` : ''}`.trim(),
    `Configuration: ${specs.configuration}`,
    `Build type: ${inputs.enclosureType} (${specs.duty})`,
    `Sub qty/size: ${specs.quantity} ${specs.size}`,
    `Port qty: ${inputs.portQuantity}`,
    `External dims: ${inch(specs.boxWidth)} W x ${inch(specs.boxHeight)} H x ${inch(specs.boxDepth)} D`,
    `Internal dims: ${inch(calculations.internalWidth)} W x ${inch(calculations.internalHeight)} H x ${inch(calculations.internalDepthWithDB)} D`,
    `Net airspace: ${round(specs.internalVolume, 3)} cu ft (${round(calculations.netAirSpacePerChamber, 3)} cu ft/chamber)`,
    `Tuning: ${round(specs.tuningFreq, 1)} Hz`,
    `Port: width ${inch(inputs.portWidth)}, height ${inch(calculations.portHeight)}, area ${round(calculations.portArea, 2)} sq in, port/cube ${round(calculations.sqInPerCube, 2)}, L1 ${inch(calculations.portLength1)}, L2 ${inch(calculations.portLength2)}`,
    `Sub cutout: ${inch(inputs.subCutoutDiameter)}; outside diameter: ${inch(inputs.outsideDiameter)}; displacement: ${round(inputs.subDisplacement, 3)} cu ft`,
    `Baffle fit: ${calculations.baffleCheck.status}; edge clearance ${inch(calculations.baffleCheck.edgeClearance)}; sub-to-sub gap ${inch(calculations.baffleCheck.subToSubGap)}`,
    `Subwoofer position: ${subwooferPlacement ? `${subwooferPlacement.safe ? 'Safe' : 'Unsafe'}; offset X ${signedInch(inputs.subwooferXOffset ?? 0)}, Y ${signedInch(inputs.subwooferYOffset ?? 0)}` : 'Centered on baffle'}`,
    `Extended port routing: ${yesNo(labyrinthActive)}; folds ${labyrinthFoldCount}`,
    `Flush mount: ${yesNo(inputs.recessedMounting)}`,
    `Terminal cup: ${terminalPanel}${terminalCustomized ? `, X offset ${signedInch(inputs.terminalXOffset ?? 0)}` : ', default placement'}; Y fixed 2.125" from panel bottom`,
    `Plexi window: ${windowEnabled ? `${windowSize} on ${windowPanel}; plate ${inch(windowDimensions.plateW)} x ${inch(windowDimensions.plateH)}; cutout ${inch(windowDimensions.cutoutW)} x ${inch(windowDimensions.cutoutH)}; offset X ${signedInch(inputs.windowXOffset ?? 0)}, Y ${signedInch(inputs.windowYOffset ?? 0)}; corner radius ${inch(inputs.windowCornerRadius ?? 0.125, 3)}` : 'None'}`,
    `Pricing tier: ${validated.tier}`,
    `Lead time: ${validated.leadTimeDays} days`,
    `Estimated shipping weight: ${estimatedWeightPounds} lb`,
    `Customer notes: ${customerNotes || 'None'}`,
  ].join('\n');

  const productionSnapshot = {
    source: 'BHS enclosure designer',
    engine: {
      package: '@adireaudio/enclosure-engine',
      revision: engineRevision,
    },
    designSummary,
    productionDetails,
    customerNotes,
    designSpecs: specs,
    inputs,
    calculations: {
      internalWidth: round(calculations.internalWidth),
      internalHeight: round(calculations.internalHeight),
      internalDepthWithDB: round(calculations.internalDepthWithDB),
      netAirSpacePerChamber: round(calculations.netAirSpacePerChamber, 3),
      netAirSpaceForPortCalculations: round(calculations.netAirSpaceForPortCalculations, 3),
      portHeight: round(calculations.portHeight),
      portArea: round(calculations.portArea, 2),
      portLength1: round(calculations.portLength1),
      portLength2: round(calculations.portLength2),
      sqInPerCube: round(calculations.sqInPerCube, 2),
      baffleCheck: calculations.baffleCheck,
      labyrinthPort: {
        active: labyrinthActive,
        foldCount: labyrinthFoldCount,
      },
    },
    options: {
      terminalPanel,
      terminalCustomized,
      terminalXOffset: round(inputs.terminalXOffset ?? 0, 3),
      windowEnabled,
      windowPanel,
      windowSize,
      windowDimensions,
      windowXOffset: round(inputs.windowXOffset ?? 0, 3),
      windowYOffset: round(inputs.windowYOffset ?? 0, 3),
      subwooferPositionCustomized:
        inputs.subwooferXOffset !== undefined || inputs.subwooferYOffset !== undefined,
      subwooferXOffset: round(inputs.subwooferXOffset ?? 0, 3),
      subwooferYOffset: round(inputs.subwooferYOffset ?? 0, 3),
      subwooferPlacementSafe: subwooferPlacement?.safe ?? true,
    },
    pricingTier: validated.tier,
    leadTimeDays: validated.leadTimeDays,
    estimatedWeightPounds,
    appProxyCustomerId: proxyContext.loggedInCustomerId,
  };

  const lineAttributes = [
    attr('Subwoofer brand', specs.brand),
    attr('Subwoofer model', specs.modelName || specs.model),
    attr('Subwoofer model code', specs.model),
    attr('Subwoofer size', specs.size),
    attr('Subwoofer quantity', specs.quantity),
    attr('Configuration', specs.configuration),
    attr('Duty', specs.duty),
    attr('External dimensions', `${inch(specs.boxWidth)} W x ${inch(specs.boxHeight)} H x ${inch(specs.boxDepth)} D`),
    attr('Net airspace', `${specs.internalVolume} cu ft`),
    attr('Tuning', `${specs.tuningFreq} Hz`),
    attr('Flush mount', specs.flushMount ? 'Yes' : 'No'),
    attr('Plexi window', windowEnabled ? windowSize : 'None'),
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
          note: [
            `Custom enclosure designer request: ${designSummary}`,
            customerNotes ? `Customer notes:\n${customerNotes}` : null,
            'Internal build details are stored in draft order metafields under bhs_build.',
          ].filter(Boolean).join('\n\n'),
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
                value: estimatedWeightPounds,
                unit: 'POUNDS',
              },
              customAttributes: lineAttributes,
            },
          ],
          customAttributes: [
            attr('Source', 'BHS enclosure designer'),
            attr('Design summary', designSummary),
            attr('Lead time days', validated.leadTimeDays),
          ],
          metafields: [
            {
              namespace: 'bhs_build',
              key: 'production_details',
              type: 'multi_line_text_field',
              value: productionDetails,
            },
            {
              namespace: 'bhs_build',
              key: 'production_snapshot',
              type: 'json',
              value: JSON.stringify(productionSnapshot),
            },
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
