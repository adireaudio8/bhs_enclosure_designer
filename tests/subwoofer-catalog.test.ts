import { describe, expect, it } from 'vitest';
import {
  buildCustomerSubwooferCatalog,
  findCustomerModelVariant,
} from '../src/lib/subwoofer-catalog';

describe('customer subwoofer catalog', () => {
  it('uses the shared brand model list and attaches conservative size-specific specs', () => {
    const catalog = buildCustomerSubwooferCatalog(
      [
        {
          name: 'Example Audio',
          code: 'EX',
          model_codes: [{ code: 'X', full_name: 'Example X' }],
        },
      ],
      [
        {
          brand: 'Example Audio',
          model_name: 'Example X 12 D2',
          model_code: 'X',
          diameter: 12,
          displacement: 0.14,
          cutout_diameter: 11.1,
          outside_diameter: 12.7,
          mounting_depth: 8.5,
        },
        {
          brand: 'Example Audio',
          model_name: 'Example X 12 D4',
          model_code: 'X',
          diameter: 12,
          displacement: 0.15,
          cutout_diameter: 11.2,
          outside_diameter: 12.8,
          mounting_depth: 8.6,
        },
      ],
    );

    expect(catalog).toHaveLength(1);
    expect(catalog[0].models).toHaveLength(1);
    expect(findCustomerModelVariant(catalog[0].models[0], '12"')).toEqual({
      size: '12"',
      displacement: 0.15,
      cutoutDiameter: 11.2,
      outsideDiameter: 12.8,
      mountingDepth: 8.6,
    });
  });

  it('omits retired variants and brands without customer models', () => {
    const catalog = buildCustomerSubwooferCatalog(
      [
        { name: 'Empty Brand', code: 'EMPTY', model_codes: [] },
        {
          name: 'Example Audio',
          code: 'EX',
          model_codes: [{ code: 'X', full_name: 'Example X' }],
        },
      ],
      [
        {
          brand: 'Example Audio',
          model_name: 'Example X 15',
          model_code: 'X',
          diameter: 15,
          is_retired: true,
        },
      ],
    );

    expect(catalog.map((brand) => brand.name)).toEqual(['Example Audio']);
    expect(catalog[0].models[0].variants).toEqual([]);
  });
});
