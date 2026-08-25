import type { SupportedSize } from '@/lib/subwoofer-presets';

export interface BrandCatalogRow {
  name?: unknown;
  code?: unknown;
  model_codes?: unknown;
}

export interface SubwooferCatalogRow {
  brand?: unknown;
  model_name?: unknown;
  model_code?: unknown;
  diameter?: unknown;
  displacement?: unknown;
  cutout_diameter?: unknown;
  outside_diameter?: unknown;
  mounting_depth?: unknown;
  is_retired?: unknown;
}

export interface CustomerSubwooferVariant {
  size: SupportedSize;
  displacement?: number;
  cutoutDiameter?: number;
  outsideDiameter?: number;
  mountingDepth?: number;
}

export interface CustomerSubwooferModel {
  code: string;
  name: string;
  variants: CustomerSubwooferVariant[];
}

export interface CustomerSubwooferBrand {
  name: string;
  code: string;
  models: CustomerSubwooferModel[];
}

const SIZE_LABELS: Array<{ diameter: number; label: SupportedSize }> = [
  { diameter: 6.5, label: '6.5"' },
  { diameter: 8, label: '8"' },
  { diameter: 10, label: '10"' },
  { diameter: 12, label: '12"' },
  { diameter: 13.5, label: '13.5"' },
  { diameter: 15, label: '15"' },
  { diameter: 18, label: '18"' },
];

function normalized(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function sizeLabel(value: unknown): SupportedSize | null {
  const diameter = Number(value);
  if (!Number.isFinite(diameter)) return null;
  return SIZE_LABELS.find((entry) => Math.abs(entry.diameter - diameter) < 0.26)?.label ?? null;
}

function modelCodeRows(value: unknown): Array<{ code: string; name: string }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: Array<{ code: string; name: string }> = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const code = String(record.code ?? '').trim();
    if (!code || seen.has(code.toLowerCase())) continue;
    seen.add(code.toLowerCase());
    rows.push({
      code,
      name: String(record.full_name ?? record.fullName ?? '').trim() || code,
    });
  }
  return rows;
}

function matchesModel(row: SubwooferCatalogRow, code: string, fullName: string) {
  const rowCode = normalized(row.model_code);
  const targetCode = normalized(code);
  if (rowCode && rowCode === targetCode) return true;

  // Legacy catalog rows predate model_code. Match a meaningful full model
  // name (or a code of at least three characters) at the start of the stored
  // model name until those rows are tagged in the shared database.
  const rowName = normalized(row.model_name);
  const targetName = normalized(fullName);
  if (targetName.length >= 3 && rowName.startsWith(targetName)) return true;
  return targetCode.length >= 3 && rowName.startsWith(targetCode);
}

function variantsForModel(rows: SubwooferCatalogRow[], code: string, fullName: string) {
  const bySize = new Map<SupportedSize, CustomerSubwooferVariant>();
  for (const row of rows) {
    if (row.is_retired === true || !matchesModel(row, code, fullName)) continue;
    const size = sizeLabel(row.diameter);
    if (!size) continue;
    const current = bySize.get(size) ?? { size };

    // D2/D4 variants should have identical geometry. If a legacy row differs,
    // keep the largest positive measurement so the customer design remains
    // conservative for fit and displacement.
    const mergeLargest = (existing: number | undefined, incoming: unknown) => {
      const parsed = positiveNumber(incoming);
      return parsed === undefined ? existing : Math.max(existing ?? 0, parsed);
    };
    current.displacement = mergeLargest(current.displacement, row.displacement);
    current.cutoutDiameter = mergeLargest(current.cutoutDiameter, row.cutout_diameter);
    current.outsideDiameter = mergeLargest(current.outsideDiameter, row.outside_diameter);
    current.mountingDepth = mergeLargest(current.mountingDepth, row.mounting_depth);
    bySize.set(size, current);
  }
  return [...bySize.values()].sort(
    (a, b) => SIZE_LABELS.findIndex((entry) => entry.label === a.size)
      - SIZE_LABELS.findIndex((entry) => entry.label === b.size),
  );
}

export function buildCustomerSubwooferCatalog(
  brandRows: BrandCatalogRow[],
  subwooferRows: SubwooferCatalogRow[],
): CustomerSubwooferBrand[] {
  return brandRows
    .map((brand) => {
      const name = String(brand.name ?? '').trim();
      const code = String(brand.code ?? '').trim();
      const rows = subwooferRows.filter(
        (subwoofer) => normalized(subwoofer.brand) === normalized(name),
      );
      const models = modelCodeRows(brand.model_codes)
        .map((model) => ({
          ...model,
          variants: variantsForModel(rows, model.code, model.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { name, code, models };
    })
    .filter((brand) => brand.name && brand.models.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCustomerLogoChoices(brandRows: BrandCatalogRow[]) {
  const byName = new Map<string, string>();
  for (const brand of brandRows) {
    const name = String(brand.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byName.has(key)) byName.set(key, name);
  }
  return [...byName.values()].sort((a, b) => a.localeCompare(b));
}

export function findCustomerModelVariant(
  model: CustomerSubwooferModel | undefined,
  size: SupportedSize,
) {
  return model?.variants.find((variant) => variant.size === size);
}
