'use client';

/**
 * Custom Enclosure Designer — customer-facing interactive page.
 *
 * Composes pieces from @adireaudio/enclosure-engine (3D viewer + Zustand
 * store + calc functions) with a simplified, customer-friendly form.
 *
 * Stage B: page skeleton, form, 3D viewer, static price.
 * Stage C: server-validated live pricing via the app-proxy pricing route.
 * Stage D (this file, current): checkout wires through Shopify draft orders
 *   so the final price is revalidated server-side before payment.
 *
 * INTENTIONALLY NOT RENDERED here (IP protection):
 *   - <CutList /> from the engine
 *   - <CalculationsDisplay /> from the engine (too detailed)
 *   - any cost / cut-list / DXF download surfaces
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  trackDesignerView,
  trackDesignerFirstInteraction,
  trackDesignerPriceCalculated,
  trackDesignerAddToCart,
  trackDesignerInitiateCheckout,
} from '@/lib/analytics';
import {
  useEnclosureStore,
  ENCLOSURE_CONFIGURATIONS,
  SUBWOOFER_QUANTITIES,
  PORT_QUANTITIES,
  checkTerminalPlacement,
  findNearestSafeXOffset,
  panelWidthInches,
  resolveTerminalPanel,
  SAFETY_BORDER,
  TERMINAL_HALF_WIDTH,
} from '@adireaudio/enclosure-engine';
import {
  SUB_BRANDS,
  SUPPORTED_SIZES,
  SIZE_DEFAULTS,
  DUTY_OPTIONS,
  suggestBoxDimensions,
  subCountFromQuantity,
  type SupportedSize,
  type SubwooferBrand,
  type SubQuantityWord,
} from '@/lib/subwoofer-presets';

// Engine's 3D viewer — load client-side only; Three.js requires `window`.
const EnclosureViewer3D = dynamic(
  () => import('@adireaudio/enclosure-engine').then((m) => m.EnclosureViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video w-full bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-text-muted text-sm">
        Loading 3D preview…
      </div>
    ),
  },
);

const APP_PROXY_BASE =
  process.env.NEXT_PUBLIC_APP_PROXY_BASE_PATH || '/apps/enclosure-designer';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function appApi(path: string) {
  const endpoint = `${APP_PROXY_BASE}/api/${path.replace(/^\/+/, '')}`;
  if (typeof window === 'undefined' || !window.location.search) {
    return endpoint;
  }

  return `${endpoint}${window.location.search}`;
}

export default function CustomEnclosureDesigner() {
  const inputs = useEnclosureStore((s) => s.inputs);
  const calculations = useEnclosureStore((s) => s.calculations);
  const setEnclosureType = useEnclosureStore((s) => s.setEnclosureType);
  const setEnclosureConfiguration = useEnclosureStore((s) => s.setEnclosureConfiguration);
  const setSubwooferQuantity = useEnclosureStore((s) => s.setSubwooferQuantity);
  const setSize = useEnclosureStore((s) => s.setSize);
  const setSubwooferBrand = useEnclosureStore((s) => s.setSubwooferBrand);
  const setSubDisplacement = useEnclosureStore((s) => s.setSubDisplacement);
  const setSubCutoutDiameter = useEnclosureStore((s) => s.setSubCutoutDiameter);
  const setOutsideDiameter = useEnclosureStore((s) => s.setOutsideDiameter);
  const setBoxDepth = useEnclosureStore((s) => s.setBoxDepth);
  const setBoxHeight = useEnclosureStore((s) => s.setBoxHeight);
  const setPortWidth = useEnclosureStore((s) => s.setPortWidth);
  const setTuningFrequency = useEnclosureStore((s) => s.setTuningFrequency);
  const setNetAirSpace = useEnclosureStore((s) => s.setNetAirSpace);
  const setPortQuantity = useEnclosureStore((s) => s.setPortQuantity);
  const setInputs = useEnclosureStore((s) => s.setInputs);
  const cutList = useEnclosureStore((s) => s.cutList);
  const setSelectedLogoName = useEnclosureStore((s) => s.setSelectedLogoName);
  const setLogoEpsContent = useEnclosureStore((s) => s.setLogoEpsContent);

  // Apply size-based defaults whenever brand/size/quantity changes.
  // Customer never has to know exact OD / cutout / displacement values; we
  // pre-fill from the curated table. They can still override box dims
  // manually below if they want a specific shape.
  const [hasInteracted, setHasInteracted] = useState(false);

  // ─── Analytics — designer funnel events ────────────────────────────────
  // Fire `designer_view` once on mount. Then watch hasInteracted to fire
  // `designer_first_interaction` exactly once when the customer touches
  // any field. The pricing-effect below fires `designer_price_calculated`
  // on first transition to 'ok'. Checkout events fire from handleAddToCart.
  useEffect(() => {
    trackDesignerView({
      brand: inputs.subwooferBrand ?? undefined,
      size: inputs.size,
    });
    // Only fire once per page mount — deps left intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firedFirstInteractionRef = useRef(false);
  useEffect(() => {
    if (hasInteracted && !firedFirstInteractionRef.current) {
      firedFirstInteractionRef.current = true;
      trackDesignerFirstInteraction('any');
    }
  }, [hasInteracted]);

  useEffect(() => {
    // First mount: seed reasonable defaults so the 3D viewer has something
    // to render and the customer sees a real preview from the get-go.
    if (hasInteracted) return;
    const size = inputs.size as SupportedSize;
    const defaults = SIZE_DEFAULTS[size] ?? SIZE_DEFAULTS['12"'];
    const qty = inputs.subwooferQuantity as SubQuantityWord;
    const dims = suggestBoxDimensions(size, qty);

    setEnclosureType('Birch Ply - Regular Duty');
    setOutsideDiameter(defaults.outsideDiameter);
    setSubCutoutDiameter(defaults.subCutoutDiameter);
    setSubDisplacement(defaults.subDisplacement);
    setBoxDepth(dims.boxDepth);
    setBoxHeight(dims.boxHeight);
    setPortWidth(defaults.recommendedPortWidthIn);
    setTuningFrequency(defaults.recommendedTuningHz);
    setNetAirSpace(defaults.recommendedNetVolume * subCountFromQuantity(qty));
  }, [
    hasInteracted,
    inputs.size,
    inputs.subwooferQuantity,
    setEnclosureType,
    setOutsideDiameter,
    setSubCutoutDiameter,
    setSubDisplacement,
    setBoxDepth,
    setBoxHeight,
    setPortWidth,
    setTuningFrequency,
    setNetAirSpace,
  ]);

  function applyPresetDefaults(size: SupportedSize, qty: SubQuantityWord) {
    const defaults = SIZE_DEFAULTS[size];
    const dims = suggestBoxDimensions(size, qty);
    setOutsideDiameter(defaults.outsideDiameter);
    setSubCutoutDiameter(defaults.subCutoutDiameter);
    setSubDisplacement(defaults.subDisplacement);
    setBoxDepth(dims.boxDepth);
    setBoxHeight(dims.boxHeight);
    setPortWidth(defaults.recommendedPortWidthIn);
    setTuningFrequency(defaults.recommendedTuningHz);
    setNetAirSpace(defaults.recommendedNetVolume * subCountFromQuantity(qty));
  }

  // ─── Live pricing via app-proxy API (debounced) ────────────────────────
  // Server runs Supabase catalog lookup. Never trust the client to compute
  // its own price — checkout re-validates this value before creating the
  // Shopify draft order.
  //
  // 'unavailable' is intentional: when Supabase is unreachable / has no
  // matching tier row, we deliberately don't fall back to a computed or
  // placeholder price. The UI shows a "contact us to complete this order"
  // CTA instead — better to refuse a quote than show a wrong number.
  type PricingTier = 'guest' | 'customer' | 'dealer' | 'distributor';
  type PricingState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok'; price: number; leadTimeDays: number; baffleStatus: string; tier: PricingTier }
    | { status: 'unavailable'; baffleStatus: string }
    | { status: 'error'; message: string };

  const [pricing, setPricing] = useState<PricingState>({ status: 'idle' });

  // Track whether we've already fired the price-calculated analytics
  // event for this page mount. We only want it once per session — if
  // the customer keeps tweaking inputs, every subsequent valid price
  // is just iteration, not a fresh "they got a quote" moment.
  const firedPriceCalculatedRef = useRef(false);

  // Stable serialization key so the effect doesn't loop on object identity.
  const inputsKey = JSON.stringify(inputs);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPricing({ status: 'loading' });
      try {
        const res = await fetch(appApi('design-pricing'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: inputsKey,
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        // 503 with priceUnavailable → real "no quote possible" signal,
        // not a transient error. Surface contact CTA.
        if (res.status === 503 && data.priceUnavailable) {
          setPricing({
            status: 'unavailable',
            baffleStatus: String(data.baffleStatus ?? 'OK'),
          });
          return;
        }
        if (!res.ok) {
          setPricing({
            status: 'error',
            message: String(data.error ?? 'Pricing failed'),
          });
          return;
        }
        const rawTier = String(data.tier ?? 'guest');
        const tier: PricingTier =
          rawTier === 'customer' || rawTier === 'dealer' || rawTier === 'distributor'
            ? rawTier
            : 'guest';
        const price = Number(data.price) || 0;
        setPricing({
          status: 'ok',
          price,
          leadTimeDays: Number(data.leadTimeDays) || 21,
          baffleStatus: String(data.baffleStatus ?? 'OK'),
          tier,
        });
        // Fire the funnel event once per page mount the first time we
        // get a real quote back. Helps measure how many visitors make
        // it past the "saw a price" stage of the funnel.
        if (!firedPriceCalculatedRef.current && price > 0) {
          firedPriceCalculatedRef.current = true;
          trackDesignerPriceCalculated({
            price,
            tier,
            size: inputs.size,
            quantity: inputs.subwooferQuantity,
            duty: inputs.enclosureType.includes('Heavy')
              ? 'HD'
              : inputs.enclosureType.includes('Standard')
              ? 'SD'
              : 'RD',
            volume: Number(inputs.netAirSpace) || 0,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setPricing({
          status: 'error',
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [inputsKey]);

  const canAddToCart =
    pricing.status === 'ok' &&
    calculations.baffleCheck.status !== 'DOES NOT FIT';

  // ─── Terminal cup placement state (mirrors calculator's DesignTerminalPanel) ─
  // Three states the customer can pick:
  //   - default (legacy): terminalPanel undefined → uses single/dual hardcoded
  //     panel default, centered offset, 2.125" from bottom
  //   - customized: terminalPanel = 'Side Left' | 'Back', custom X offset
  //   - no cup: terminalPanel = 'None', no cutout / hole / plate generated
  const resolvedTerminalPanel = resolveTerminalPanel(inputs);
  const isTerminalCustomized =
    inputs.terminalPanel !== undefined || inputs.terminalXOffset !== undefined;
  const isNoTerminalCup = inputs.terminalPanel === 'None';
  // Geometry-bound panel: when 'None' is selected we still need a placeholder
  // for X-offset math (which gets ignored), so default to Side Left for the
  // safety/width helpers below. The user-visible state stays 'None'.
  const currentTerminalPanel: 'Side Left' | 'Back' =
    inputs.terminalPanel === 'None'
      ? resolvedTerminalPanel === 'None'
        ? 'Side Left'
        : resolvedTerminalPanel
      : (inputs.terminalPanel ?? (resolvedTerminalPanel === 'None' ? 'Side Left' : resolvedTerminalPanel));
  const currentTerminalOffset = inputs.terminalXOffset ?? 0;
  // Skip the live placement check when there's no cup to place — there's
  // nothing to validate against the no-go bands.
  const terminalPlacementCheck = isNoTerminalCup
    ? { safe: true, footprint: { xMin: 0, xMax: 0 } }
    : checkTerminalPlacement(
        inputs,
        calculations,
        cutList,
        currentTerminalPanel,
        currentTerminalOffset,
      );
  const terminalPanelWidth = panelWidthInches(currentTerminalPanel, inputs, calculations);
  const maxTerminalOffset = Math.max(
    0,
    terminalPanelWidth / 2 - TERMINAL_HALF_WIDTH - SAFETY_BORDER,
  );

  function handleTerminalEnable(enabled: boolean) {
    setHasInteracted(true);
    if (enabled) {
      // "Customize" turns ON: seed with the resolved default panel +
      // centered offset, but never seed 'None' here (operator opts into
      // 'None' explicitly via the panel dropdown).
      const seed: 'Side Left' | 'Back' =
        resolvedTerminalPanel === 'None' ? 'Side Left' : resolvedTerminalPanel;
      setInputs({ terminalPanel: seed, terminalXOffset: 0 });
    } else {
      // "Customize" turns OFF: clear both fields so the design reverts to
      // the legacy hardcoded behavior (panel by config, centered).
      setInputs({ terminalPanel: undefined, terminalXOffset: undefined });
    }
  }
  function handleTerminalSnap() {
    const safe = findNearestSafeXOffset(
      inputs,
      calculations,
      cutList,
      currentTerminalPanel,
      currentTerminalOffset,
    );
    if (safe !== null) {
      setInputs({ terminalXOffset: safe });
    }
  }

  // ─── Logo fetch on brand change ───────────────────────────────────────
  // 3D viewer auto-renders the logo (debossed on the baffle) when both
  // selectedLogoName and logoEpsContent are set. We just have to fetch
  // the EPS content from Supabase via the app-proxy brand-logo route.
  // If the route returns 404/503/etc, we silently skip — viewer still
  // works without a logo.
  useEffect(() => {
    if (!inputs.subwooferBrand) {
      setSelectedLogoName('None');
      setLogoEpsContent(null);
      return;
    }
    let cancelled = false;
    const brand = inputs.subwooferBrand;

    fetch(appApi(`brand-logo/${encodeURIComponent(brand)}`))
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: { brand: string; eps: string } | null) => {
        if (cancelled) return;
        if (!data) {
          setSelectedLogoName('None');
          setLogoEpsContent(null);
          return;
        }
        setSelectedLogoName(data.brand);
        setLogoEpsContent(data.eps);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedLogoName('None');
        setLogoEpsContent(null);
      });

    return () => {
      cancelled = true;
    };
  }, [inputs.subwooferBrand, setSelectedLogoName, setLogoEpsContent]);

  // ─── Checkout handler ─────────────────────────────────────────────────
  const router = useRouter();
  const [cartState, setCartState] = useState<
    | { status: 'idle' }
    | { status: 'adding' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  async function handleAddToCart() {
    if (!canAddToCart || pricing.status !== 'ok') return;

    setCartState({ status: 'adding' });

    // Friendly summary fields the draft order / Shopify admin will see.
    // NOT cut list, NOT cost breakdown.
    const designSpecs = {
      brand: inputs.subwooferBrand ?? '',
      model: inputs.subwooferModel ?? '',
      size: inputs.size,
      quantity: inputs.subwooferQuantity,
      configuration: inputs.enclosureConfiguration,
      duty: inputs.enclosureType.includes('Heavy')
        ? 'HD'
        : inputs.enclosureType.includes('Standard')
        ? 'SD'
        : 'RD',
      boxWidth: round(calculations.boxWidth, 2),
      boxHeight: round(inputs.boxHeight, 2),
      boxDepth: round(inputs.boxDepth, 2),
      internalVolume: round(inputs.netAirSpace, 2),
      tuningFreq: round(inputs.tuningFrequency, 0),
      portArea: round(calculations.portArea, 1),
    };

    // Fire the standard "AddToCart" event BEFORE the API call so we
    // capture the click intent regardless of whether the server-side
    // checkout creation succeeds. Both GA4 and Meta Pixel use this canonical
    // name for ecommerce funnel reports.
    trackDesignerAddToCart({
      price: pricing.price,
      size: designSpecs.size,
      quantity: designSpecs.quantity,
      duty: designSpecs.duty,
    });

    try {
      const res = await fetch(appApi('checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, designSpecs }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        setCartState({
          status: 'error',
          message: data.error ?? `Checkout failed (${res.status})`,
        });
        return;
      }
      // Success — fire InitiateCheckout (matches Meta/GA4 standard
      // ecommerce funnel) and navigate to the Shopify checkout URL.
      trackDesignerInitiateCheckout({ price: pricing.price });
      setCartState({ status: 'idle' });
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        router.push('/cart');
      }
    } catch (err) {
      setCartState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  }

  // Friendly readouts for the review section (NO cut list, NO chamber math).
  // External W×H×D omitted on purpose — the customer is already editing
  // those numbers directly in the Dimensions card right below.
  const reviewFields = useMemo(() => {
    return {
      volume: `${round(inputs.netAirSpace, 2)} cu ft`,
      tuning: `${round(inputs.tuningFrequency, 0)} Hz`,
      portArea: `${round(calculations.portArea, 1)} sq in`,
      portPerCube: `${round(calculations.sqInPerCube, 1)} sq in/cu ft`,
      subFit: calculations.baffleCheck.status,
      subFitOk: calculations.baffleCheck.status === 'OK',
    };
  }, [calculations, inputs]);

  return (
    <div className="bg-neutral-950 text-white">
      {/* Compact hero — padding kept tight so the grid below has more
          headroom on small-laptop viewports. */}
      <header className="border-b border-neutral-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1 className="font-[family-name:var(--font-display)] text-xl sm:text-2xl tracking-wide uppercase">
              Design Your Custom Enclosure
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400">
              Baltic birch and MDF · Made in California · ships in <strong className="text-white">2–3 weeks</strong>
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Layout target: fit on a single laptop screen without scrolling.
            row 1: viewer (3/5)  | Configuration (2/5, expanded with the
                                 | most-edited inputs: tuning + net volume
                                 | + port width)
            row 2: dimensions    | Price + Checkout + Terminal Cup
                                 | (the right column wrapper continues
                                 | spanning both rows)
            row 3: SUMMARY readout (full width strip below)              */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:items-stretch">
          {/* 3D viewer — left column row 1. Capped at 480px tall so the
              16:9 box doesn't push everything below the fold on small
              laptop screens (1366×768). */}
          <div className="space-y-2">
            <div className="bhs-viewer-shell w-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden h-[clamp(300px,48vh,520px)]">
              <EnclosureViewer3D />
            </div>
            <p className="text-xs text-text-muted">
              Drag to rotate • scroll • right-click to pan
            </p>
          </div>

          {/* Right column wrapper — spans rows 1-2 in col 2 on lg */}
          <div className="lg:row-span-3 lg:col-start-2 lg:row-start-1 flex flex-col gap-2">
          <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Configuration
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Brand">
                  <select
                    className="select-base"
                    value={inputs.subwooferBrand ?? ''}
                    onChange={(e) => {
                      setHasInteracted(true);
                      setSubwooferBrand(e.target.value as SubwooferBrand);
                    }}
                  >
                    <option value="">Select…</option>
                    {SUB_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Size">
                  <select
                    className="select-base"
                    value={inputs.size}
                    onChange={(e) => {
                      setHasInteracted(true);
                      const newSize = e.target.value as SupportedSize;
                      setSize(newSize);
                      applyPresetDefaults(newSize, inputs.subwooferQuantity as SubQuantityWord);
                    }}
                  >
                    {SUPPORTED_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <Field label="Sub qty">
                  <select
                    className="select-base"
                    value={inputs.subwooferQuantity}
                    onChange={(e) => {
                      setHasInteracted(true);
                      const q = e.target.value as SubQuantityWord;
                      if (SUBWOOFER_QUANTITIES.includes(q)) {
                        setSubwooferQuantity(q);
                        applyPresetDefaults(inputs.size as SupportedSize, q);
                      }
                    }}
                  >
                    {(['Single', 'Dual', 'Triple', 'Quad'] as const).map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Port qty">
                  <select
                    className="select-base"
                    value={inputs.portQuantity}
                    onChange={(e) => {
                      setHasInteracted(true);
                      setPortQuantity(e.target.value as typeof PORT_QUANTITIES[number]);
                    }}
                  >
                    {PORT_QUANTITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subs facing" className="col-span-2 sm:col-span-1">
                  <select
                    className="select-base"
                    value={inputs.enclosureConfiguration}
                    onChange={(e) => {
                      setHasInteracted(true);
                      setEnclosureConfiguration(
                        e.target.value as typeof ENCLOSURE_CONFIGURATIONS[number],
                      );
                    }}
                  >
                    {ENCLOSURE_CONFIGURATIONS.map((cfg) => (
                      <option key={cfg} value={cfg}>
                        {cfg}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-2">
                <Field label="Duty (build strength)">
                  <select
                    className="select-base"
                    value={inputs.enclosureType}
                    onChange={(e) => {
                      setHasInteracted(true);
                      setEnclosureType(e.target.value as typeof inputs.enclosureType);
                    }}
                  >
                    {DUTY_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.enclosureType}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Most-edited tuning controls live up here next to the brand/size
                  pickers so the customer doesn't have to look down at a
                  separate "Dimensions" card to tweak them. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-neutral-800">
                <Field label="Tuning (Hz)">
                  <NumberInput
                    value={inputs.tuningFrequency}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setTuningFrequency(v);
                    }}
                    min={20}
                    max={50}
                    step={1}
                  />
                </Field>
                <Field label="Net volume (cu ft)">
                  <NumberInput
                    value={inputs.netAirSpace}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setNetAirSpace(v);
                    }}
                    min={0.3}
                    max={20}
                    step={0.05}
                  />
                </Field>
                <Field label="Port width (in)">
                  <NumberInput
                    value={inputs.portWidth}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setPortWidth(v);
                    }}
                    min={0.5}
                    max={6}
                    step={0.125}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <Field label="Sub displacement (cu ft)">
                  <NumberInput
                    value={inputs.subDisplacement}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setSubDisplacement(v);
                    }}
                    min={0.01}
                    max={1.5}
                    step={0.01}
                  />
                </Field>
                <Field label="Sub cutout (in)">
                  <NumberInput
                    value={inputs.subCutoutDiameter}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setSubCutoutDiameter(v);
                    }}
                    min={4}
                    max={22}
                    step={0.01}
                  />
                </Field>
                <Field label="Sub OD (in)">
                  <NumberInput
                    value={inputs.outsideDiameter}
                    onChange={(v) => {
                      setHasInteracted(true);
                      setOutsideDiameter(v);
                    }}
                    min={4}
                    max={24}
                    step={0.01}
                  />
                </Field>
              </div>
              {/* Flush (recessed) sub mounting toggle.
                  SBPB / SUPP: structural baffle becomes 18mm Birch with a
                  flange recess; an internal Sub Mount Plate is added.
                  Internal depth shrinks by ~0.7".
                  SUPB: an 18mm Birch Sub Mount Cap is added on top of the
                  enclosure carrying the flange recess. Internal height
                  shrinks by ~0.7". Port width auto-adjusts on toggle to
                  preserve port area (and hence box volume + tuning).
                  MDF designs gated off — Birch only for V1. */}
              {(() => {
                const flushAvailable = !inputs.enclosureType.includes('MDF');
                const isSUPB = inputs.enclosureConfiguration === 'Subs Up/Port Back';
                return (
                  <label className={`mt-3 flex items-start gap-2 text-[12px] ${flushAvailable ? 'text-neutral-300 cursor-pointer' : 'text-text-muted cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={!flushAvailable}
                      checked={!!inputs.recessedMounting}
                      onChange={(e) => {
                        setHasInteracted(true);
                        const next = e.target.checked;
                        // SUPB: scale portWidth inversely with internalHeight
                        // change so port area is preserved on toggle. SBPB
                        // doesn't change internalHeight, so no port shift.
                        if (isSUPB) {
                          const B1 = 0.709;
                          const oldIntH = calculations.internalHeight;
                          const newIntH = next ? (oldIntH - B1) : (oldIntH + B1);
                          if (oldIntH > 0 && newIntH > 0 && inputs.portWidth > 0) {
                            const raw = inputs.portWidth * (oldIntH / newIntH);
                            const newPortWidth = Math.round(raw * 100) / 100;
                            setInputs({ recessedMounting: next || undefined, portWidth: newPortWidth });
                            return;
                          }
                        }
                        setInputs({ recessedMounting: next || undefined });
                      }}
                    />
                    <span>
                      <span className={`font-medium ${flushAvailable ? 'text-neutral-200' : ''}`}>
                        Flush (recessed) sub mounting
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {!flushAvailable
                          ? 'Available on Birch designs only.'
                          : isSUPB
                          ? 'Adds an 18mm Birch cap on top with flange recess. Port width auto-adjusts to preserve port area.'
                          : 'Adds a sub-mount plate behind the baffle so the sub sits flush with the box face. Adds cost.'}
                      </span>
                    </span>
                  </label>
                );
              })()}
            </section>

          {/* Terminal cup placement — sits ABOVE the Price/ATC block so
              the checkout button is the visually-final action of the
              right column. Compact when "Customize" is off; expanded form
              uses a 3-column grid (Panel + X offset + status) so toggling
              customize doesn't push the rest of the page down by a whole
              row. Silent on success — no "✓ safe" line, just the absence
              of a warning. */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Terminal Cup
              </h2>
              <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTerminalCustomized}
                  onChange={(e) => handleTerminalEnable(e.target.checked)}
                  className="accent-red-600"
                />
                Customize
              </label>
            </div>
            {!isTerminalCustomized ? (
              <p className="text-[11px] text-text-muted">
                Default: <span className="text-neutral-300 font-mono">{resolvedTerminalPanel}</span>{' '}
                panel,
                centered, 2.125&quot; from bottom. Check &ldquo;Customize&rdquo; to override or skip.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Panel">
                    <select
                      className="select-base"
                      value={inputs.terminalPanel ?? 'Side Left'}
                      onChange={(e) => {
                        const next = e.target.value as 'Side Left' | 'Back' | 'None';
                        setHasInteracted(true);
                        if (next === 'None') {
                          // No cup: clear the X offset so the saved data
                          // doesn't carry a stale value.
                          setInputs({ terminalPanel: 'None', terminalXOffset: undefined });
                        } else {
                          setInputs({ terminalPanel: next, terminalXOffset: 0 });
                        }
                      }}
                    >
                      <option value="Side Left">Side Left</option>
                      <option value="Back">Back</option>
                      <option value="None">No Terminal Cup</option>
                    </select>
                  </Field>
                  {!isNoTerminalCup && (
                    <Field
                      label={`X offset${maxTerminalOffset > 0
                        ? ` (±${maxTerminalOffset.toFixed(2)}″)`
                        : ''}`}
                    >
                      <NumberInput
                        value={currentTerminalOffset}
                        onChange={(v) => {
                          setHasInteracted(true);
                          const snapped = Math.round(v / 0.125) * 0.125;
                          const clamped = Math.max(
                            -maxTerminalOffset,
                            Math.min(maxTerminalOffset, snapped),
                          );
                          setInputs({ terminalXOffset: clamped });
                        }}
                        min={-maxTerminalOffset}
                        max={maxTerminalOffset}
                        step={0.125}
                      />
                    </Field>
                  )}
                </div>
                {isNoTerminalCup ? (
                  <p className="mt-2 text-[11px] text-amber-300/80">
                    No terminal cup will be cut. Wire-through will be the
                    customer&apos;s responsibility.
                  </p>
                ) : (
                  !terminalPlacementCheck.safe && (
                    <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-red-950/40 border border-red-900/60 rounded text-[11px] text-red-300">
                      <span>
                        ⚠ Conflicts with{' '}
                        <span className="font-mono">
                          {terminalPlacementCheck.conflict?.reason ?? 'a no-go zone'}
                        </span>{' '}
                        on the {currentTerminalPanel} panel.
                      </span>
                      <button
                        type="button"
                        onClick={handleTerminalSnap}
                        className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white whitespace-nowrap text-[11px]"
                      >
                        Snap to safe
                      </button>
                    </div>
                  )
                )}
              </>
            )}
          </section>

          {/* Price + Checkout — visually-final action; sits below the
              Terminal Cup customization. mt-auto pins this card to the
              bottom of the right column wrapper so its bottom edge
              aligns with the bottom of the Dimensions card on the left. */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mt-auto">
              {/* Tier badge — only renders for dealer / distributor accounts.
                  Logged-out and retail customers see nothing here. */}
              {pricing.status === 'ok' && (pricing.tier === 'dealer' || pricing.tier === 'distributor') && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {pricing.tier === 'dealer' ? 'Dealer pricing' : 'Distributor pricing'}
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-neutral-400">Estimated price</span>
                <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
                  {pricing.status === 'ok' ? formatCurrency(pricing.price) :
                   pricing.status === 'loading' ? <span className="text-text-muted">…</span> :
                   pricing.status === 'unavailable' ? <span className="text-amber-400 text-sm">contact us</span> :
                   pricing.status === 'error' ? <span className="text-amber-400 text-sm">unavailable</span> :
                   '$—'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 mb-2">
                {pricing.status === 'ok'
                  ? `ships in ${pricing.leadTimeDays} days`
                  : pricing.status === 'unavailable'
                  ? 'see message below'
                  : pricing.status === 'error'
                  ? 'Adjust an input to retry'
                  : 'Calculating…'}
              </p>
              {!canAddToCart && pricing.status === 'ok' && calculations.baffleCheck.status === 'DOES NOT FIT' && (
                <p className="text-[11px] text-red-400 mb-2">
                  Subwoofer doesn&apos;t fit on the baffle. Adjust width or quantity.
                </p>
              )}
              {pricing.status === 'unavailable' && (
                <div className="mb-2 rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-[12px] leading-relaxed text-amber-200">
                  <p className="font-semibold mb-1">We can&apos;t price this configuration online right now.</p>
                  <p className="mb-2 text-amber-200/80">
                    Email or call us with your specs above and we&apos;ll get you a quote.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <a
                      href="mailto:info@bassheadsupply.com?subject=Custom%20Enclosure%20Quote%20Request"
                      className="text-amber-100 hover:text-white underline underline-offset-2"
                    >
                      info@bassheadsupply.com
                    </a>
                    <a
                      href="tel:+14157401182"
                      className="text-amber-100 hover:text-white underline underline-offset-2"
                    >
                      (415) 740-1182
                    </a>
                  </div>
                </div>
              )}
              {cartState.status === 'error' && (
                <p className="text-[11px] text-red-400 mb-2">{cartState.message}</p>
              )}
              <button
                type="button"
                disabled={!canAddToCart || cartState.status === 'adding'}
                onClick={handleAddToCart}
                className={`w-full px-4 py-2.5 rounded-md font-medium transition-colors ${
                  canAddToCart && cartState.status !== 'adding'
                    ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                    : 'bg-neutral-700 text-neutral-300 cursor-not-allowed'
                }`}
                title={
                  canAddToCart
                    ? 'Continue to checkout with this custom enclosure'
                    : pricing.status === 'unavailable'
                    ? 'Contact us to complete this order'
                    : 'Resolve issues above before checkout'
                }
              >
                {cartState.status === 'adding' ? 'Creating checkout…' : 'Continue to Checkout'}
              </button>
          </section>
          </div>{/* close right column wrapper */}

          {/* Summary readout — left column row 2, sits directly under
              the 3D viewer per Andre's request. Compact horizontal
              layout so it eats ~50px of vertical real estate. */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 lg:col-start-1 lg:row-start-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
              Summary
            </h2>
            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs">
              <SummaryItem label="Volume" value={reviewFields.volume} />
              <SummaryItem label="Tuning" value={reviewFields.tuning} />
              <SummaryItem label="Port area" value={reviewFields.portArea} />
              <SummaryItem label="Port/cube" value={reviewFields.portPerCube} />
              <div className="flex items-baseline gap-1.5">
                <span className="text-neutral-400">Sub fit</span>
                <span
                  className={`font-mono font-semibold ${
                    reviewFields.subFitOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {reviewFields.subFit}
                </span>
              </div>
            </div>
          </div>
        </section>

          {/* Dimensions — left column row 3 (below Summary). Just the
              box geometry; tuning + sub-related inputs live in
              Configuration. */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 lg:col-start-1 lg:row-start-3">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Dimensions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Height (in)">
              <NumberInput
                value={inputs.boxHeight}
                onChange={(v) => {
                  setHasInteracted(true);
                  setBoxHeight(v);
                }}
                min={6}
                max={36}
                step={0.125}
              />
            </Field>
            <Field label="Depth (in)">
              <NumberInput
                value={inputs.boxDepth}
                onChange={(v) => {
                  setHasInteracted(true);
                  setBoxDepth(v);
                }}
                min={6}
                max={36}
                step={0.125}
              />
            </Field>
            <Field label="Width (auto)">
              <ReadOnlyInput value={round(calculations.boxWidth, 2)} />
            </Field>
          </div>
        </section>
        </div>
      </div>

      {/* Local Tailwind helpers via @apply — keeps the JSX terse without
          polluting globals.css. If similar patterns crop up elsewhere we'll
          promote these into shared component classes. */}
      <style jsx>{`
        :global(.select-base) {
          width: 100%;
          background: rgb(23 23 23);
          border: 1px solid rgb(38 38 38);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
        }
        :global(.btn-toggle) {
          width: 100%;
          background: rgb(23 23 23);
          border: 1px solid rgb(38 38 38);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          color: rgb(212 212 212);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        :global(.btn-toggle:hover) {
          background: rgb(38 38 38);
        }
        :global(.btn-toggle-on) {
          background: rgb(220 38 38);
          border-color: rgb(220 38 38);
          color: white;
        }
        :global(.btn-toggle-on:hover) {
          background: rgb(185 28 28);
        }
        :global(.bhs-viewer-shell > div) {
          height: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          background: rgb(23 23 23);
          border: 0;
          border-radius: 0.5rem;
        }
        :global(.bhs-viewer-shell > div > div:first-child) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.35rem 0.5rem;
          background: rgb(17 17 17);
          border-color: rgb(38 38 38);
        }
        :global(.bhs-viewer-shell h3) {
          color: rgb(245 245 245);
          font-size: 0.8rem;
          line-height: 1rem;
          white-space: nowrap;
        }
        :global(.bhs-viewer-shell button) {
          border-radius: 0.25rem;
          background: rgb(38 38 38);
          color: white;
          font-size: 0.68rem;
          line-height: 1rem;
          padding: 0.2rem 0.38rem;
          white-space: nowrap;
          transition: background 0.15s ease;
        }
        :global(.bhs-viewer-shell button:hover) {
          background: rgb(64 64 64);
        }
        :global(.bhs-viewer-shell > div > div:last-child) {
          flex: 1 1 auto;
          min-height: 0;
        }
        :global(.bhs-viewer-shell canvas) {
          height: 100% !important;
        }
        @media (max-width: 640px) {
          :global(.bhs-viewer-shell > div > div:first-child) {
            gap: 0.35rem;
          }
          :global(.bhs-viewer-shell h3) {
            font-size: 0.74rem;
          }
          :global(.bhs-viewer-shell button) {
            font-size: 0.62rem;
            padding: 0.18rem 0.32rem;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Tiny presentational helpers (kept local to avoid premature abstraction) ─

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block mb-3 last:mb-0 ${className}`}>
      <span className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="select-base"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

function ReadOnlyInput({ value }: { value: number | string }) {
  return (
    <input
      type="text"
      className="select-base bg-neutral-950 text-neutral-400"
      value={value}
      readOnly
    />
  );
}

// Inline label/value pair for the horizontal Summary strip below the grid.
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-neutral-400">{label}</span>
      <span className="font-mono font-semibold text-white">{value}</span>
    </div>
  );
}

function round(v: number, digits: number): number {
  if (!Number.isFinite(v)) return 0;
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}
