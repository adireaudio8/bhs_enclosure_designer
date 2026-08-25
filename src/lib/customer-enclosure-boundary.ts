import type { EnclosureInputs } from '@adireaudio/enclosure-engine';

/**
 * Enforce the customer product boundary server-side. The public designer sells
 * assembled press-together enclosures, uses automatic slot-port routing, and
 * currently offers only the two standard acrylic sizes. Customer-controlled
 * subwoofer offsets are retained only for the supported Subs Up / Port Back
 * layout.
 */
export function sanitizeCustomerEnclosureInputs(inputs: EnclosureInputs): EnclosureInputs {
  const allowsSubwooferPosition = inputs.enclosureConfiguration === 'Subs Up/Port Back';
  const standardWindowSize = inputs.windowSize === '24x12' ? '24x12' : '12x12';
  return {
    ...inputs,
    assemblyMethod: 'Press Together',
    forceLabyrinthPort: false,
    kerfPortEnabled: false,
    kerfPortRadius: undefined,
    windowSize: inputs.windowEnabled ? standardWindowSize : undefined,
    windowCustomWidth: undefined,
    windowCustomHeight: undefined,
    subwooferXOffset: allowsSubwooferPosition ? inputs.subwooferXOffset : undefined,
    subwooferYOffset: allowsSubwooferPosition ? inputs.subwooferYOffset : undefined,
  };
}

/** A missing, non-finite, zero, or negative price must never reach checkout. */
export function resolvePositiveOnlinePrice(value: unknown): number | null {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}
