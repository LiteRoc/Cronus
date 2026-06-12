export function computeBenchmarkComparison(asset, template) {
  const actualAnnual = asset.metrics?.projectedAnnualMaintenance ?? 0;
  const capitalValue =
    asset.purchase?.price ??
    asset.purchaseCost ??
    template?.benchmark?.averageQuotedPrice ??
    0;

  const expectedAnnual = template?.benchmark?.expectedAnnualMaintenance ?? null;
  const expectedCCR = template?.benchmark?.expectedCapitalCostRatio ?? null;

  const actualCCR =
    capitalValue > 0 ? actualAnnual / capitalValue : null;

  const annualMaintenanceVariance =
    expectedAnnual != null ? actualAnnual - expectedAnnual : null;

  const annualMaintenanceVariancePercent =
    expectedAnnual > 0
      ? ((actualAnnual - expectedAnnual) / expectedAnnual) * 100
      : null;

  const ccrVariance =
    expectedCCR != null && actualCCR != null
      ? actualCCR - expectedCCR
      : null;

  const ccrVariancePercent =
    expectedCCR > 0 && actualCCR != null
      ? ((actualCCR - expectedCCR) / expectedCCR) * 100
      : null;

  return {
    capitalValue,
    actualAnnualMaintenance: actualAnnual,
    expectedAnnualMaintenance: expectedAnnual,
    actualCapitalCostRatio: actualCCR,
    expectedCapitalCostRatio: expectedCCR,
    annualMaintenanceVariance,
    annualMaintenanceVariancePercent,
    ccrVariance,
    ccrVariancePercent,
  };
}