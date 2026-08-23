const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;
const toDate = (value) => (value instanceof Date ? new Date(value) : new Date(value));

function validDate(value, label) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
}

function asFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function amendmentDelta(amendment) {
  if (typeof amendment.totalDelta === "number" && Number.isFinite(amendment.totalDelta)) {
    return amendment.totalDelta;
  }
  return (amendment.items ?? []).reduce(
    (sum, item) => sum + asFiniteNumber(item?.deltaValue),
    0
  );
}

function amendmentIdentity(amendment, index) {
  return amendment._id?.toString?.() ?? String(amendment._id ?? index);
}

/**
 * Contract value model:
 * - contract.totalValue is the immutable annual baseline established at creation.
 * - only applied, financially included amendments change realized annual value.
 * - totalDelta/deltaValue are signed amounts and are added exactly once; changeType
 *   controls coverage behavior and never changes the financial sign.
 */
export function buildAppliedTimeline(contract) {
  const annualBase = asFiniteNumber(contract.totalValue);
  const applied = (contract.amendments ?? [])
    .map((amendment, index) => ({ amendment, index }))
    .filter(({ amendment }) => amendment?.status === "applied" && !amendment.excludeFromFinancials)
    .sort((left, right) => {
      const dateOrder = validDate(left.amendment.date, "amendment date") -
        validDate(right.amendment.date, "amendment date");
      if (dateOrder !== 0) return dateOrder;
      const numberOrder = String(left.amendment.amendmentNumber ?? "")
        .localeCompare(String(right.amendment.amendmentNumber ?? ""));
      if (numberOrder !== 0) return numberOrder;
      return amendmentIdentity(left.amendment, left.index)
        .localeCompare(amendmentIdentity(right.amendment, right.index));
    });

  let running = annualBase;
  const events = applied.map(({ amendment, index }) => {
    const annualDelta = amendmentDelta(amendment);
    running += annualDelta;
    return {
      amendmentId: amendmentIdentity(amendment, index),
      amendmentNumber: amendment.amendmentNumber ?? null,
      effectiveDate: validDate(amendment.date, "amendment date").toISOString(),
      description: amendment.description,
      changeType: amendment.changeType,
      annualDelta,
      annualValueAfter: running,
      isBaseline: false,
    };
  });

  return { annualBase, events };
}

export function calculateAnnualValueAsOf(contract, asOf) {
  const asOfDate = validDate(asOf, "asOf");
  const { annualBase, events } = buildAppliedTimeline(contract);

  let annualValueAsOf = annualBase;
  const appliedEvents = [];
  for (const event of events) {
    if (validDate(event.effectiveDate, "amendment effective date") > asOfDate) break;
    annualValueAsOf = event.annualValueAfter;
    appliedEvents.push(event);
  }

  return {
    annualBase,
    annualDeltaApplied: annualValueAsOf - annualBase,
    annualValueAsOf,
    appliedEvents,
  };
}

export function proratedValueBetween(contract, rangeStart, rangeEnd) {
  const start = validDate(rangeStart, "rangeStart");
  const end = validDate(rangeEnd, "rangeEnd");
  if (end <= start) return 0;

  const termStart = validDate(contract.startDate, "contract startDate");
  const termEnd = validDate(contract.endDate, "contract endDate");
  const clippedStart = start < termStart ? termStart : start;
  const clippedEnd = end > termEnd ? termEnd : end;
  if (clippedEnd <= clippedStart) return 0;

  const amendmentDates = buildAppliedTimeline(contract).events
    .map((event) => validDate(event.effectiveDate, "amendment effective date"))
    .filter((date) => date > clippedStart && date < clippedEnd);
  const uniqueBoundaries = [...new Set(amendmentDates.map((date) => date.getTime()))]
    .sort((left, right) => left - right)
    .map((timestamp) => new Date(timestamp));
  const boundaries = [clippedStart, ...uniqueBoundaries, clippedEnd];

  let total = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index];
    const segmentEnd = boundaries[index + 1];
    const { annualValueAsOf } = calculateAnnualValueAsOf(contract, segmentStart);
    total += annualValueAsOf * ((segmentEnd - segmentStart) / MS_PER_DAY / DAYS_PER_YEAR);
  }
  return total;
}

/** Calendar-year YTD, clipped to the Contract term and amendment timeline. */
export function calculateCalendarYearRevenueAsOf(contract, asOf) {
  const effectiveAsOf = validDate(asOf, "asOf");
  const ytdStart = new Date(Date.UTC(effectiveAsOf.getUTCFullYear(), 0, 1));
  const annual = calculateAnnualValueAsOf(contract, effectiveAsOf).annualValueAsOf;
  const ytd = proratedValueBetween(contract, ytdStart, effectiveAsOf);
  return { annual, ytd, ytdStart };
}
