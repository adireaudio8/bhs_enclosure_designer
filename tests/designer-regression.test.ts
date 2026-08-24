import { describe, expect, it } from 'vitest';
import {
  calculateEnclosure,
  DEFAULT_INPUTS,
  type EnclosureInputs,
} from '@adireaudio/enclosure-engine';
import {
  resolvePositiveOnlinePrice,
  sanitizeCustomerEnclosureInputs,
} from '../src/lib/customer-enclosure-boundary';

const normalInputs: EnclosureInputs = {
  ...DEFAULT_INPUTS,
  boxDepth: 18,
  boxHeight: 16,
  portWidth: 1.75,
  tuningFrequency: 32,
  netAirSpace: 2,
  subDisplacement: 0.15,
  subCutoutDiameter: 11.19,
  outsideDiameter: 12.81,
  size: '12"',
};

describe('customer enclosure regression boundary', () => {
  it('keeps a normal design on its standard port geometry', () => {
    const calculations = calculateEnclosure(normalInputs);

    expect(calculations.labyrinthPort.active).toBe(false);
    expect(calculations.baffleCheck.status).not.toBe('DOES NOT FIT');
  });

  it('automatically activates multi-fold routing when the standard solve cannot fit', () => {
    const calculations = calculateEnclosure({
      ...normalInputs,
      tuningFrequency: 20,
      netAirSpace: 1.5,
      portWidth: 2,
    });

    expect(calculations.labyrinthPort.active).toBe(true);
    expect(calculations.labyrinthPort.panels.length).toBeGreaterThan(2);
  });

  it('removes the customer-supplied manual labyrinth override', () => {
    const sanitized = sanitizeCustomerEnclosureInputs({
      ...normalInputs,
      forceLabyrinthPort: true,
    });

    expect(sanitized.forceLabyrinthPort).toBe(false);
    expect(calculateEnclosure(sanitized).labyrinthPort.active).toBe(false);
  });

  it.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-price'])(
    'fails closed for invalid online price %s',
    (value) => {
      expect(resolvePositiveOnlinePrice(value)).toBeNull();
    },
  );

  it('accepts only a positive finite online price', () => {
    expect(resolvePositiveOnlinePrice(354.99)).toBe(354.99);
  });
});
