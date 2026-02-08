// src/services/amendmentLifecycleService.js
import mongoose from "mongoose";

/**
 * Applies the business impact of an amendment to a contract in-memory:
 * - mutates coveredAssets + totalValue
 * - does NOT touch status/seq/numbering
 *
 * Works for preview and for real apply (real apply will call finalize after this).
 */
export function applyAmendmentImpactToContract(contract, idx) {
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);

  const changeType = amendment.changeType;
  const items = amendment.items || [];
  const totalDelta =
    typeof amendment.totalDelta === "number"
      ? amendment.totalDelta
      : items.reduce((s, i) => s + (i.deltaValue || 0), 0);

  // safety defaults
  contract.totalValue = Number(contract.totalValue ?? 0);
  contract.coveredAssets = Array.isArray(contract.coveredAssets) ? contract.coveredAssets : [];

  const itemIds = items.map((i) => i.assetId.toString());
  const covered = contract.coveredAssets;

  if (changeType === "add") {
    itemIds.forEach((id) => {
      if (!covered.some((a) => a.toString() === id)) covered.push(id);
    });
    contract.totalValue += totalDelta;
  } else if (changeType === "remove") {
    contract.coveredAssets = covered.filter((a) => !itemIds.includes(a.toString()));
    contract.totalValue += totalDelta; // should be negative
  } else if (changeType === "update") {
    contract.totalValue += totalDelta;
  } else {
    throw new Error(`Invalid changeType: ${changeType}`);
  }

  return { totalDelta, itemIds };
}

/**
 * Finalizes an approved amendment apply:
 * - requires amendment.status === "approved"
 * - assigns seq + amendmentNumber
 * - sets status to applied + audit fields
 */
export function finalizeApprovedAmendmentApply(contract, idx, actorId) {
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);
  if (amendment.status !== "approved") {
    throw new Error(`Amendment at idx=${idx} must be approved to apply (found ${amendment.status})`);
  }

  contract.amendmentSeq = Number(contract.amendmentSeq ?? 0) + 1;
  amendment.amendmentNumber = `${contract.contractNumber}.${contract.amendmentSeq}`;

  amendment.status = "applied";
  amendment.appliedAt = new Date();
  amendment.appliedBy = actorId
    ? mongoose.Types.ObjectId.createFromHexString(actorId)
    : undefined;
}

/**
 * Your existing "apply approved" becomes a small orchestrator:
 */
export function applyApprovedAmendmentToContract(contract, idx, actorId) {
  // require approved
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);
  if (amendment.status !== "approved") {
    throw new Error(`Amendment at idx=${idx} must be approved to apply (found ${amendment.status})`);
  }

  applyAmendmentImpactToContract(contract, idx);
  finalizeApprovedAmendmentApply(contract, idx, actorId);
}