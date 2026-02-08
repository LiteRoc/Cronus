// src/services/amendmentPreviewService.js
import { applyAmendmentImpactToContract } from "./amendmentLifecycleService.js";
import { calculateAnnualValueAsOf, proratedValueBetween } from "./contractValueService.js";

export function previewApplyApprovedAmendment(contract, idx) {
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);
  if (amendment.status !== "approved") {
    throw new Error(`Amendment must be approved to preview apply (found ${amendment.status})`);
  }

  const beforeAssets = new Set((contract.coveredAssets || []).map((a) => a.toString()));
  const beforeTotalValue = Number(contract.totalValue ?? 0);

  // optional financial "before"
  const effectiveDate = new Date(amendment.date);
  const beforeAnnual = calculateAnnualValueAsOf(contract, effectiveDate);
  const beforeRemainingTermValue = proratedValueBetween(contract, effectiveDate, new Date(contract.endDate));

  // Clone contract in-memory (no DB writes)
  // contract is a Mongoose doc here; toObject gives a plain clone
  const clone = contract.toObject({ depopulate: true });
  // Apply impact ONLY
  const { totalDelta } = applyAmendmentImpactToContract(clone, idx);

  const afterAssets = new Set((clone.coveredAssets || []).map((a) => a.toString()));
  const afterTotalValue = Number(clone.totalValue ?? 0);

  const addedAssetIds = [...afterAssets].filter((id) => !beforeAssets.has(id));
  const removedAssetIds = [...beforeAssets].filter((id) => !afterAssets.has(id));

  // optional financial "after"
  const afterAnnual = calculateAnnualValueAsOf(clone, effectiveDate);
  const afterRemainingTermValue = proratedValueBetween(clone, effectiveDate, new Date(clone.endDate));

  return {
    contractId: String(contract._id),
    contractNumber: contract.contractNumber ?? null,
    amendmentIndex: idx,
    amendmentStatus: amendment.status,
    effectiveDate: effectiveDate.toISOString(),
    totalDelta,
    before: {
      coveredAssetsCount: beforeAssets.size,
      totalValue: beforeTotalValue,
      annualValueAsOf: beforeAnnual.annualValueAsOf,
      remainingTermValue: beforeRemainingTermValue,
    },
    after: {
      coveredAssetsCount: afterAssets.size,
      totalValue: afterTotalValue,
      annualValueAsOf: afterAnnual.annualValueAsOf,
      remainingTermValue: afterRemainingTermValue,
    },
    diff: {
      addedAssetIds,
      removedAssetIds,
      totalValueDelta: afterTotalValue - beforeTotalValue,
      annualValueDeltaAsOf: afterAnnual.annualValueAsOf - beforeAnnual.annualValueAsOf,
      remainingTermValueDelta: afterRemainingTermValue - beforeRemainingTermValue,
    },
  };
}