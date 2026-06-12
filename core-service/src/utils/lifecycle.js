function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeLifecycleMetrics({
  asset,
  template = null,
  lifetimeMaintenanceTotal = 0,
  last12MonthMaintenanceTotal = 0,
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

  const projectedAnnualMaintenance = round2(last12MonthMaintenanceTotal);

  // Replacement logic
  let replacementRecommended = false;
  let replacementReason = null;

  if (expectedLifeYears && yearsInService >= expectedLifeYears) {
    replacementRecommended = true;
    replacementReason = "End of expected life";
  }

  if (
    hasPurchaseValue &&
    currentBookValue <= 1.5 * projectedAnnualMaintenance &&
    projectedAnnualMaintenance > 0
  ) {
    replacementRecommended = true;
    replacementReason = replacementReason
      ? replacementReason + "; Book value low vs maintenance trend"
      : "Book value low vs maintenance trend";
  }

  return {
    totalMaintenanceCost: round2(lifetimeMaintenanceTotal),
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
