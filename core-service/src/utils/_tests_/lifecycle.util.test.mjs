import lifecycleUtils from '../lifecycle.js';

const { computeLifecycleMetrics } = lifecycleUtils;

describe('computeLifecycleMetrics', () => {
  test('computes straight-line depreciation and book value (clamped to salvage)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const asset = {
      purchase: {
        price: 10000,
        date: new Date('2016-01-01T00:00:00Z'),
        expectedLifeYears: 10,
        salvageValue: 1000,
      },
    };

    const metrics = computeLifecycleMetrics({
      asset,
      template: null,
      lifetimeMaintenanceTotal: 0,
      last12MonthMaintenanceTotal: 0,
      now,
    });

    // 10 years in service, depreciation (10000-1000)/10 = 900/yr *10 = 9000
    // book value = 10000 - 9000 = 1000 (clamped)
    expect(metrics.annualDepreciation).toBe(900);
    expect(metrics.currentBookValue).toBe(1000);
    expect(metrics.yearsInService).toBeCloseTo(10, 2);
  });

  test('recommends replacement when yearsInService >= expectedLifeYears', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const asset = {
      purchase: { price: 5000, date: new Date('2015-01-01T00:00:00Z'), expectedLifeYears: 10, salvageValue: 0 },
    };

    const metrics = computeLifecycleMetrics({ asset, template: null, lifetimeMaintenanceTotal: 0, last12MonthMaintenanceTotal: 0, now });

    expect(metrics.replacementRecommended).toBe(true);
    expect(metrics.replacementReason).toMatch(/End of expected life/i);
  });

  test('recommends replacement when bookValue <= 1.5x projectedAnnualMaintenance', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const asset = {
      purchase: { price: 10000, date: new Date('2024-01-01T00:00:00Z'), expectedLifeYears: 10, salvageValue: 0 },
    };

    // ~2 years in service -> annualDep=1000 -> book value ~8000
    // projected = 6000 -> 1.5x = 9000, bookValue (8000) <= 9000 => recommend
    const metrics = computeLifecycleMetrics({
      asset,
      template: null,
      lifetimeMaintenanceTotal: 12000,
      last12MonthMaintenanceTotal: 6000,
      now,
    });

    expect(metrics.projectedAnnualMaintenance).toBe(6000);
    expect(metrics.replacementRecommended).toBe(true);
    expect(metrics.replacementReason).toMatch(/Book value low vs maintenance trend/i);
  });

  test('falls back to template expected life when asset purchase.expectedLifeYears missing', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    const asset = {
      purchase: { price: 10000, date: new Date('2016-01-01T00:00:00Z'), salvageValue: 0 },
    };

    const template = {
      lifecycleDefaults: { expectedLifeYears: 8 },
      eolYears: 12,
    };

    const metrics = computeLifecycleMetrics({ asset, template, lifetimeMaintenanceTotal: 0, last12MonthMaintenanceTotal: 0, now });

    // 10 years in service, expectedLifeYears=8 triggers replacement
    expect(metrics.replacementRecommended).toBe(true);
    expect(metrics.replacementReason).toMatch(/End of expected life/i);
  });

  test('supports legacy purchaseCost/purchaseDate when purchase object missing', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    const asset = {
      purchaseCost: 10000,
      purchaseDate: new Date('2021-01-01T00:00:00Z'),
    };

    const template = { lifecycleDefaults: { expectedLifeYears: 10 } };

    const metrics = computeLifecycleMetrics({ asset, template, lifetimeMaintenanceTotal: 0, last12MonthMaintenanceTotal: 0, now });

    expect(metrics.currentBookValue).toBeGreaterThan(0);
    expect(metrics.yearsInService).toBeCloseTo(5, 1);
  });
});
