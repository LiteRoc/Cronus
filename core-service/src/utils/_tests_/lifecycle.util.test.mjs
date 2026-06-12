import lifecycleUtils from '../lifecycle.js';

const { computeLifecycleMetrics } = lifecycleUtils;

describe('computeLifecycleMetrics', () => {
  test('uses ECRI benchmark quoted price when asset purchase price is missing', () => {
    const asset = {
      purchase: null,
      metrics: {},
    };

    const template = {
      benchmark: {
        averageQuotedPrice: 187694,
        expectedUsefulLifeYears: 5,
      },
    };

    const result = computeLifecycleMetrics({
      asset,
      template,
      lifetimeMaintenanceTotal: 135,
      last12MonthMaintenanceTotal: 135,
      now: new Date('2026-06-12T00:00:00Z'),
    });

    expect(result.currentBookValue).toBe(187694);
    expect(result.annualDepreciation).toBe(37538.8);
    expect(result.replacementRecommended).toBe(false);
  });

  test('does not recommend replacement when capital value is unknown', () => {
    const asset = {
      purchase: null,
      purchaseCost: undefined,
    };

    const template = {};

    const result = computeLifecycleMetrics({
      asset,
      template,
      lifetimeMaintenanceTotal: 500,
      last12MonthMaintenanceTotal: 500,
      now: new Date('2026-06-12T00:00:00Z'),
    });

    expect(result.currentBookValue).toBe(0);
    expect(result.replacementRecommended).toBe(false);
    expect(result.replacementReason).toBe(null);
  });

  test('recommends replacement when asset is beyond expected useful life', () => {
    const asset = {
      purchase: {
        price: 10000,
        date: new Date('2015-01-01T00:00:00Z'),
        expectedLifeYears: 10,
        salvageValue: 0,
      },
    };

    const result = computeLifecycleMetrics({
      asset,
      template: null,
      lifetimeMaintenanceTotal: 0,
      last12MonthMaintenanceTotal: 0,
      now: new Date('2026-01-01T00:00:00Z'),
    });

    expect(result.replacementRecommended).toBe(true);
    expect(result.replacementReason).toMatch(/End of expected life/i);
  });
});