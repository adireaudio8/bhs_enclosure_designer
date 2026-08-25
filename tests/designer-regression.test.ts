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
import {
  CUSTOMER_NOTES_MAX_LENGTH,
  normalizeCustomerNotes,
} from '../src/lib/customer-notes';
import { renderDesignerProxyWrapper } from '../src/lib/proxy-wrapper';

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

  it('locks unsupported manufacturing options at the customer boundary', () => {
    const sanitized = sanitizeCustomerEnclosureInputs({
      ...normalInputs,
      assemblyMethod: 'Flat Pack',
      kerfPortEnabled: true,
      kerfPortRadius: 3,
      windowEnabled: true,
      windowSize: 'custom',
      windowCustomWidth: 30,
      windowCustomHeight: 18,
    });

    expect(sanitized.assemblyMethod).toBe('Press Together');
    expect(sanitized.kerfPortEnabled).toBe(false);
    expect(sanitized.kerfPortRadius).toBeUndefined();
    expect(sanitized.windowSize).toBe('12x12');
    expect(sanitized.windowCustomWidth).toBeUndefined();
    expect(sanitized.windowCustomHeight).toBeUndefined();
  });

  it('keeps subwoofer offsets only for the customer-supported top panel layout', () => {
    const supported = sanitizeCustomerEnclosureInputs({
      ...normalInputs,
      enclosureConfiguration: 'Subs Up/Port Back',
      subwooferXOffset: 0.5,
      subwooferYOffset: -0.25,
    });
    const unsupported = sanitizeCustomerEnclosureInputs({
      ...normalInputs,
      enclosureConfiguration: 'Subs Back/Port Back',
      subwooferXOffset: 0.5,
      subwooferYOffset: -0.25,
    });

    expect(supported.subwooferXOffset).toBe(0.5);
    expect(supported.subwooferYOffset).toBe(-0.25);
    expect(unsupported.subwooferXOffset).toBeUndefined();
    expect(unsupported.subwooferYOffset).toBeUndefined();
  });

  it('normalizes and bounds customer notes', () => {
    expect(normalizeCustomerNotes('  Fit behind seat\r\n\u0000Call first  ')).toBe(
      'Fit behind seat\nCall first',
    );
    expect(normalizeCustomerNotes('x'.repeat(CUSTOMER_NOTES_MAX_LENGTH + 50))).toHaveLength(
      CUSTOMER_NOTES_MAX_LENGTH,
    );
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

  it('relays embedded designer height and suppresses the nested scrollbar', async () => {
    const response = renderDesignerProxyWrapper(
      new Request('https://bhsenclosuredesigner.vercel.app/shopify/enclosure-designer?embedded=1'),
    );
    const html = await response.text();

    expect(html).toContain("var resizeMessage = 'bhs:designer-resize'");
    expect(html).toContain("window.parent.postMessage({ type: resizeMessage, height: height }, '*')");
    expect(html).toContain('id="bhs-designer-frame"');
    expect(html).toContain('scrolling="no"');
  });
});
