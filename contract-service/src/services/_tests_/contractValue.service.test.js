import {
  buildAppliedTimeline,
  calculateAnnualValueAsOf,
  calculateCalendarYearRevenueAsOf,
  proratedValueBetween,
} from "../contractValueService.js";

const date = (value) => new Date(value);
const BASE = 100000;

function amendment(overrides = {}) {
  return {
    _id: overrides.amendmentNumber ?? "amendment",
    amendmentNumber: "VALUE.1",
    date: date("2026-04-01T00:00:00.000Z"),
    status: "applied",
    changeType: "update",
    items: [{ assetId: "asset", deltaValue: 10000 }],
    totalDelta: 10000,
    ...overrides,
  };
}

function contract(overrides = {}) {
  return {
    startDate: date("2026-01-01T00:00:00.000Z"),
    endDate: date("2027-01-01T00:00:00.000Z"),
    totalValue: BASE,
    amendments: [],
    ...overrides,
  };
}

describe("Contract annual value source of truth", () => {
  test("base value with no amendments remains the creation baseline", () => {
    expect(calculateAnnualValueAsOf(contract(), date("2026-06-01")).annualValueAsOf).toBe(BASE);
  });

  test.each([
    ["add positive", "add", 10000, 110000],
    ["remove negative", "remove", -20000, 80000],
    ["update positive", "update", 10000, 110000],
    ["update negative", "update", -20000, 80000],
  ])("adds the signed delta exactly once for %s", (_label, changeType, delta, expected) => {
    const value = calculateAnnualValueAsOf(
      contract({ amendments: [amendment({ changeType, totalDelta: delta })] }),
      date("2026-04-01T00:00:00.000Z")
    );
    expect(value.annualDeltaApplied).toBe(delta);
    expect(value.annualValueAsOf).toBe(expected);
  });

  test("returns historical values before, on, between, and after amendments", () => {
    const valueContract = contract({
      amendments: [
        amendment({ amendmentNumber: "VALUE.1", date: date("2026-04-01"), totalDelta: 10000 }),
        amendment({ amendmentNumber: "VALUE.2", date: date("2026-10-01"), totalDelta: -20000 }),
      ],
    });

    expect(calculateAnnualValueAsOf(valueContract, date("2026-03-31T23:59:59.999Z")).annualValueAsOf).toBe(100000);
    expect(calculateAnnualValueAsOf(valueContract, date("2026-04-01T00:00:00.000Z")).annualValueAsOf).toBe(110000);
    expect(calculateAnnualValueAsOf(valueContract, date("2026-09-30T23:59:59.999Z")).annualValueAsOf).toBe(110000);
    expect(calculateAnnualValueAsOf(valueContract, date("2026-10-01T00:00:00.000Z")).annualValueAsOf).toBe(90000);
  });

  test.each(["draft", "submitted", "approved", "declined", "voided"])(
    "%s amendment does not affect realized value",
    (status) => {
      const result = calculateAnnualValueAsOf(
        contract({ amendments: [amendment({ status })] }),
        date("2026-12-01")
      );
      expect(result.annualValueAsOf).toBe(BASE);
      expect(result.appliedEvents).toHaveLength(0);
    }
  );

  test("timeline ordering is deterministic for equal effective dates", () => {
    const timeline = buildAppliedTimeline(contract({
      amendments: [
        amendment({ _id: "b", amendmentNumber: "VALUE.2", totalDelta: -20000 }),
        amendment({ _id: "a", amendmentNumber: "VALUE.1", totalDelta: 10000 }),
      ],
    }));
    expect(timeline.events.map((event) => event.amendmentNumber)).toEqual(["VALUE.1", "VALUE.2"]);
    expect(timeline.events.map((event) => event.annualValueAfter)).toEqual([110000, 90000]);
  });
});

describe("Contract value proration and profitability revenue", () => {
  const valueContract = contract({
    amendments: [
      amendment({ amendmentNumber: "VALUE.1", date: date("2026-04-01"), totalDelta: 10000 }),
      amendment({ amendmentNumber: "VALUE.2", date: date("2026-10-01"), totalDelta: -20000 }),
    ],
  });

  test("range proration follows each effective annual value segment", () => {
    const expected = (100000 * 90 + 110000 * 183 + 90000 * 92) / 365;
    expect(proratedValueBetween(valueContract, date("2026-01-01"), date("2027-01-01")))
      .toBeCloseTo(expected, 6);
  });

  test("remaining term value uses the value effective at the range start", () => {
    expect(proratedValueBetween(valueContract, date("2026-10-01"), date("2027-01-01")))
      .toBeCloseTo(90000 * 92 / 365, 6);
  });

  test("calendar-year YTD profitability revenue changes across an amendment", () => {
    const before = calculateCalendarYearRevenueAsOf(valueContract, date("2026-03-01"));
    const after = calculateCalendarYearRevenueAsOf(valueContract, date("2026-06-01"));
    expect(before.annual).toBe(100000);
    expect(after.annual).toBe(110000);
    expect(before.ytd).toBeCloseTo(100000 * 59 / 365, 6);
    expect(after.ytd).toBeCloseTo((100000 * 90 + 110000 * 61) / 365, 6);
  });

  test("profitability revenue is clipped to Contract start and end", () => {
    const clipped = contract({
      startDate: date("2026-03-01"),
      endDate: date("2026-04-01"),
    });
    expect(calculateCalendarYearRevenueAsOf(clipped, date("2026-02-01")).ytd).toBe(0);
    expect(calculateCalendarYearRevenueAsOf(clipped, date("2026-12-01")).ytd)
      .toBeCloseTo(100000 * 31 / 365, 6);
  });
});
