function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeLifecycleMetrics({
  asset,
  template = null,
  lifetimeMaintenanceTotal = null,
  last12MonthMaintenanceTotal = null,
  maintenanceScopes = null,
  now = new Date(),
}) {
  // Resolve purchase values (support legacy fields)
  const price =
    asset.purchase?.price ??
    asset.purchaseCost ??
    template?.benchmark?.averageQuotedPrice ??
    0;

  const hasPurchaseValue = price > 0;

  const purchaseDate =
    asset.purchase?.date ??
    asset.purchaseDate ??
    asset.acquisitionDate ??
    asset.installationDate ??
    null;

  const salvageValue =
    asset.purchase?.salvageValue ?? 0;

  const expectedLifeYears =
    asset.purchase?.expectedLifeYears ??
    template?.lifecycleDefaults?.expectedLifeYears ??
    template?.benchmark?.expectedUsefulLifeYears ??
    template?.eolYears ??
    null;

  let yearsInService = 0;
  if (purchaseDate) {
    const ms = now - new Date(purchaseDate);
    yearsInService = ms > 0 ? ms / (1000 * 60 * 60 * 24 * 365.25) : 0;
  }

  let annualDepreciation = 0;
  let currentBookValue = price;

  if (price > 0 && expectedLifeYears > 0) {
    annualDepreciation =
      (price - salvageValue) / expectedLifeYears;

    currentBookValue =
      price - (annualDepreciation * yearsInService);

    currentBookValue = Math.max(salvageValue, currentBookValue);
  }

  currentBookValue = round2(currentBookValue);
  annualDepreciation = round2(annualDepreciation);

  const projectedAnnualMaintenance = last12MonthMaintenanceTotal == null ? null : round2(last12MonthMaintenanceTotal);
  const directAnnual = maintenanceScopes?.last12Months?.directMaintenance;
  const costTrend = directAnnual ? directAnnual.total : projectedAnnualMaintenance;

  // Replacement logic
  let replacementRecommended = false;
  let replacementReason = null;

  if (expectedLifeYears && yearsInService >= expectedLifeYears) {
    replacementRecommended = true;
    replacementReason = "End of expected life";
  }

  if (
    hasPurchaseValue &&
    costTrend !== null && currentBookValue <= 1.5 * costTrend &&
    costTrend > 0
  ) {
    replacementRecommended = true;
    replacementReason = replacementReason
      ? replacementReason + "; Book value low vs maintenance trend"
      : "Book value low vs maintenance trend";
  }

  return {
    totalMaintenanceCost: lifetimeMaintenanceTotal == null ? null : round2(lifetimeMaintenanceTotal),
    maintenanceScopes,
    calculationVersion: maintenanceScopes ? "wo-cost-v1" : null,
    costRecommendationStatus: costTrend == null ? "insufficient_economic_data" : "evaluated",
    currentBookValue,
    projectedAnnualMaintenance,
    replacementRecommended,
    replacementReason,
    yearsInService: round2(yearsInService),
    annualDepreciation,
    computedAt: now,
  };
}

module.exports = { computeLifecycleMetrics };
