import type { EnclosureInputs } from '@adireaudio/enclosure-engine';

/**
 * Customer requests may use automatic labyrinth geometry, but cannot activate
 * the internal manual override even if a crafted payload includes the field.
 */
export function sanitizeCustomerEnclosureInputs(inputs: EnclosureInputs): EnclosureInputs {
  return {
    ...inputs,
    forceLabyrinthPort: false,
  };
}

/** A missing, non-finite, zero, or negative price must never reach checkout. */
export function resolvePositiveOnlinePrice(value: unknown): number | null {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}
