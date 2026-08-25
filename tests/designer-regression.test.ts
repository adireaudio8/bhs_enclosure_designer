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
import {
  CUSTOM_LOGO_REQUEST_MAX_LENGTH,
  TOP_LOGO_CUSTOM,
  TOP_LOGO_MATCH_BRAND,
  TOP_LOGO_NONE,
  resolveTopLogoRequest,
} from '../src/lib/top-logo-request';

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

  it('defaults the top logo to the selected subwoofer brand for older clients', () => {
    expect(resolveTopLogoRequest(undefined, undefined, 'Sundown Audio')).toMatchObject({
      selection: TOP_LOGO_MATCH_BRAND,
      mode: 'match-brand',
      logoName: 'Sundown Audio',
      customRequest: '',
      valid: true,
    });
  });

  it('supports no-logo and explicit brand-logo selections', () => {
    expect(resolveTopLogoRequest(TOP_LOGO_NONE, 'ignored', 'Sundown Audio')).toMatchObject({
      mode: 'none',
      logoName: '',
      customRequest: '',
      valid: true,
    });
    expect(resolveTopLogoRequest('JL Audio', '', 'Sundown Audio')).toMatchObject({
      mode: 'brand',
      logoName: 'JL Audio',
      displayLabel: 'JL Audio',
      valid: true,
    });
  });

  it('requires, sanitizes, and bounds a custom top-logo request', () => {
    expect(resolveTopLogoRequest(TOP_LOGO_CUSTOM, '   ', 'Sundown Audio').valid).toBe(false);

    const resolved = resolveTopLogoRequest(
      TOP_LOGO_CUSTOM,
      `  Smith Audio\r\n\u0000${'x'.repeat(CUSTOM_LOGO_REQUEST_MAX_LENGTH + 50)}  `,
      'Sundown Audio',
    );
    expect(resolved).toMatchObject({
      mode: 'custom',
      logoName: '',
      valid: true,
    });
    expect(resolved.customRequest).toHaveLength(CUSTOM_LOGO_REQUEST_MAX_LENGTH);
    expect(resolved.customRequest).not.toMatch(/[\r\n\u0000]/);
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
