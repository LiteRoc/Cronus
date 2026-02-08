// src/services/tests/contractValueServiceTest.js

import {
  calculateAnnualValueAsOf,
  proratedValueBetween
} from "../contractValueService.js";

function d(s) { return new Date(s); }

describe("contractValue.service", () => {
  test("as-of date before any applied amendments returns base", () => {
    const contract = {
      startDate: d("2024-09-16"),
      endDate: d("2027-09-15T23:59:59Z"),
      totalValue: 0,
      amendments: [
        {
          date: d("2024-09-16"),
          status: "draft",
          changeType: "add",
          items: [{ assetId: "a1", deltaValue: 1610 }]
        }
      ]
    };

    const res = calculateAnnualValueAsOf(contract, d("2024-09-15"));
    expect(res.annualValueAsOf).toBe(0);
  });

  test("applied add amendment increases annual value", () => {
    const contract = {
      startDate: d("2024-09-16"),
      endDate: d("2027-09-15T23:59:59Z"),
      totalValue: 0,
      amendments: [
        {
          date: d("2024-09-16"),
          status: "applied",
          changeType: "add",
          items: [
            { assetId: "a1", deltaValue: 1610 },
            { assetId: "a2", deltaValue: 1610 },
            { assetId: "a3", deltaValue: 1610 }
          ]
        }
      ]
    };

    const res = calculateAnnualValueAsOf(contract, d("2024-09-16"));
    expect(res.annualValueAsOf).toBe(4830);
    expect(res.annualDeltaApplied).toBe(4830);
  });

  test("remove amendment subtracts annual value", () => {
    const contract = {
      startDate: d("2024-09-16"),
      endDate: d("2027-09-15T23:59:59Z"),
      totalValue: 0,
      amendments: [
        {
          date: d("2024-09-16"),
          status: "applied",
          changeType: "add",
          items: [{ assetId: "a1", deltaValue: 1000 }]
        },
        {
          date: d("2025-01-01"),
          status: "applied",
          changeType: "remove",
          items: [{ assetId: "a1", deltaValue: 200 }]
        }
      ]
    };

    const res = calculateAnnualValueAsOf(contract, d("2025-02-01"));
    expect(res.annualValueAsOf).toBe(800);
  });

  test("proratedValueBetween prorates across amendment boundary", () => {
    const contract = {
      startDate: d("2026-01-01T00:00:00Z"),
      endDate: d("2026-12-31T23:59:59Z"),
      totalValue: 0,
      amendments: [
        {
          date: d("2026-01-01T00:00:00Z"),
          status: "applied",
          changeType: "add",
          items: [{ assetId: "a1", deltaValue: 3650 }]
        },
        {
          date: d("2026-07-01T00:00:00Z"),
          status: "applied",
          changeType: "add",
          items: [{ assetId: "a2", deltaValue: 3650 }]
        }
      ]
    };

    // Full year should be about:
    // first half ~ 3650 * (181/365)
    // second half ~ 7300 * (184/365)
    const total = proratedValueBetween(contract, d("2026-01-01"), d("2027-01-01"));
    expect(total).toBeGreaterThan(5400);
    expect(total).toBeLessThan(7300);
  });

  test("proratedValueBetween clamps to contract term", () => {
    const contract = {
      startDate: d("2026-01-01"),
      endDate: d("2026-12-31T23:59:59Z"),
      totalValue: 0,
      amendments: [
        {
          date: d("2026-01-01"),
          status: "applied",
          changeType: "add",
          items: [{ assetId: "a1", deltaValue: 3650 }]
        }
      ]
    };

    // Range extends outside term, should clamp.
    const total = proratedValueBetween(contract, d("2025-01-01"), d("2028-01-01"));
    expect(total).toBeGreaterThan(3600);
    expect(total).toBeLessThan(3700);
  });
});