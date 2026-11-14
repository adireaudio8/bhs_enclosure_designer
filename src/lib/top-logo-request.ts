export const TOP_LOGO_MATCH_BRAND = '__match_subwoofer_brand__';
export const TOP_LOGO_NONE = '__no_top_logo__';
export const TOP_LOGO_CUSTOM = '__custom_top_logo__';
export const CUSTOM_LOGO_REQUEST_MAX_LENGTH = 200;

const TOP_LOGO_NAME_MAX_LENGTH = 120;

function normalizeSingleLine(value: unknown, maxLength: number) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export interface ResolvedTopLogoRequest {
  selection: string;
  mode: 'match-brand' | 'none' | 'brand' | 'custom';
  logoName: string;
  customRequest: string;
  displayLabel: string;
  valid: boolean;
  /**
   * The brand whose logo was asked for but is marked "Never use this brand's
   * logo" in the calculator's Manage Logos, or '' when none was.
   */
  blockedBrand: string;
}

export function normalizeCustomLogoRequest(value: unknown) {
  return normalizeSingleLine(value, CUSTOM_LOGO_REQUEST_MAX_LENGTH);
}

const isBlocked = (name: string, neverLogoBrandKeys?: ReadonlySet<string>) =>
  !!name && !!neverLogoBrandKeys?.has(name.toLowerCase());

/**
 * Normalize the customer-facing logo selection at the server boundary.
 *
 * Older browser clients do not send a selection, so an empty value keeps the
 * historical behavior and follows the selected subwoofer brand. A custom
 * request is valid only when the customer describes what they want.
 *
 * `neverLogoBrandKeys` holds the brands (names, lower case) whose logo must
 * never be used. Matching such a subwoofer brand means no top logo; choosing
 * such a brand's logo outright is not valid.
 */
export function resolveTopLogoRequest(
  selectionValue: unknown,
  customRequestValue: unknown,
  subwooferBrandValue: unknown,
  neverLogoBrandKeys?: ReadonlySet<string>,
): ResolvedTopLogoRequest {
  const rawSelection = normalizeSingleLine(selectionValue, TOP_LOGO_NAME_MAX_LENGTH);
  const selection = rawSelection || TOP_LOGO_MATCH_BRAND;
  const subwooferBrand = normalizeSingleLine(subwooferBrandValue, TOP_LOGO_NAME_MAX_LENGTH);

  if (selection === TOP_LOGO_NONE) {
    return {
      selection,
      mode: 'none',
      logoName: '',
      customRequest: '',
      displayLabel: 'No top logo',
      valid: true,
      blockedBrand: '',
    };
  }

  if (selection === TOP_LOGO_CUSTOM) {
    const customRequest = normalizeCustomLogoRequest(customRequestValue);
    return {
      selection,
      mode: 'custom',
      logoName: '',
      customRequest,
      displayLabel: customRequest
        ? `Custom request — ${customRequest}`
        : 'Custom logo request',
      valid: customRequest.length > 0,
      blockedBrand: '',
    };
  }

  if (selection === TOP_LOGO_MATCH_BRAND) {
    if (isBlocked(subwooferBrand, neverLogoBrandKeys)) {
      // Recorded as "no top logo", so nothing downstream can read it as the brand's logo.
      return {
        selection: TOP_LOGO_NONE,
        mode: 'none',
        logoName: '',
        customRequest: '',
        displayLabel: `No top logo (${subwooferBrand} does not allow its logo)`,
        valid: true,
        blockedBrand: subwooferBrand,
      };
    }
    return {
      selection,
      mode: 'match-brand',
      logoName: subwooferBrand,
      customRequest: '',
      displayLabel: subwooferBrand
        ? `${subwooferBrand} (matches subwoofer brand)`
        : 'No top logo (no subwoofer brand selected)',
      valid: true,
      blockedBrand: '',
    };
  }

  if (isBlocked(selection, neverLogoBrandKeys)) {
    return {
      selection,
      mode: 'brand',
      logoName: selection,
      customRequest: '',
      displayLabel: `${selection} (logo not available)`,
      valid: false,
      blockedBrand: selection,
    };
  }

  return {
    selection,
    mode: 'brand',
    logoName: selection,
    customRequest: '',
    displayLabel: selection,
    valid: true,
    blockedBrand: '',
  };
}
