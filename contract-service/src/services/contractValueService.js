// src/services/contractValueService.js

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const toDate = (d) => (d instanceof Date ? d : new Date(d));

function signForChangeType(changeType) {
  if (changeType === "add") return 1;
  if (changeType === "remove") return -1;
  return 1; // update
}

export function buildAppliedTimeline(contract) {
  const applied = (contract.amendments ?? [])
    .filter((a) => a?.status === "applied" && !a.excludeFromFinancials)
    .slice()
    .sort((a, b) => toDate(a.date) - toDate(b.date));

  const hasBaseline = applied.some((a) => a.setsBase === true);

  // ✅ If baseline amendment exists, start base at 0 so we don’t double-count contract.totalValue.
  let annualBase = hasBaseline ? 0 : (contract.totalValue ?? 0);

  let running = annualBase;
  const events = [];

  for (const a of applied) {
    const sign = signForChangeType(a.changeType);

    const rawDelta =
      typeof a.totalDelta === "number"
        ? a.totalDelta
        : (a.items ?? []).reduce((sum, it) => sum + (it.deltaValue ?? 0), 0);

    const annualDelta = rawDelta * sign;

    // ✅ BASELINE: sets annual base, does NOT apply as a delta
    if (a.setsBase === true) {
      annualBase = rawDelta;
      running = annualBase;

      events.push({
        amendmentId: a._id?.toString?.() ?? String(a._id ?? ""),
        amendmentNumber: a.amendmentNumber ?? null,
        effectiveDate: toDate(a.date).toISOString(),
        description: a.description,
        changeType: a.changeType,
        annualDelta: 0,
        annualValueAfter: running,
        isBaseline: true,
      });

      continue;
    }

    running += annualDelta;

    events.push({
      amendmentId: a._id?.toString?.() ?? String(a._id ?? ""),
      amendmentNumber: a.amendmentNumber ?? null,
      effectiveDate: toDate(a.date).toISOString(),
      description: a.description,
      changeType: a.changeType,
      annualDelta,
      annualValueAfter: running,
      isBaseline: false,
    });
  }

  return { annualBase, events };
}

export function calculateAnnualValueAsOf(contract, asOf) {
  console.log("Incoming contract:", contract);
  console.log("Incoming asOf date:", asOf);
  const asOfDate = toDate(asOf);
  const { annualBase, events } = buildAppliedTimeline(contract);

  let annualValueAsOf = annualBase;
  const appliedEvents = [];

  for (const e of events) {
    if (toDate(e.effectiveDate) <= asOfDate) {
      annualValueAsOf = e.annualValueAfter;
      appliedEvents.push(e);
    } else {
      break;
    }
  }

  return {
    annualBase,
    annualDeltaApplied: annualValueAsOf - annualBase,
    annualValueAsOf,
    appliedEvents,
  };
}

export function proratedValueBetween(contract, rangeStart, rangeEnd) {
  const start = toDate(rangeStart);
  const end = toDate(rangeEnd);
  if (end <= start) return 0;

  const termStart = toDate(contract.startDate);
  const termEnd = toDate(contract.endDate);

  const s = start < termStart ? termStart : start;
  const e = end > termEnd ? termEnd : end;
  if (e <= s) return 0;

  const amendmentDates = (contract.amendments ?? [])
    .filter((a) => a.status === "applied" && !a.excludeFromFinancials)
    .map((a) => toDate(a.date))
    .filter((d) => d > s && d < e)
    .sort((a, b) => a - b);

  const boundaries = [s, ...amendmentDates, e];

  let total = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = boundaries[i];
    const segEnd = boundaries[i + 1];

    const { annualValueAsOf } = calculateAnnualValueAsOf(contract, segStart);
    const days = (segEnd - segStart) / MS_PER_DAY;

    total += annualValueAsOf * (days / 365);
  }

  return total;
}