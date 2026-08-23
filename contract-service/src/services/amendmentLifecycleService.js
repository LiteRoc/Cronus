// src/services/amendmentLifecycleService.js
import mongoose from "mongoose";
import { AMENDMENT_TRANSITIONS, assertTransition } from "../models/Contract.js";
import { computeAmendmentImpact } from "./amendmentImpactService.js";

const AUDIT_FIELDS = {
  submitted: ["submittedAt", "submittedBy"],
  approved: ["approvedAt", "approvedBy"],
  applied: ["appliedAt", "appliedBy"],
  declined: ["declinedAt", "declinedBy"],
  voided: ["voidedAt", "voidedBy"],
};

function actorObjectId(actorId) {
  if (!mongoose.Types.ObjectId.isValid(String(actorId))) {
    throw new Error("A valid amendment audit actor is required");
  }
  return mongoose.Types.ObjectId.createFromHexString(String(actorId));
}

export function validateAmendmentDraftInput(payload = {}) {
  const { date, description, changeType, items } = payload;
  const effectiveDate = new Date(date);

  if (!date || Number.isNaN(effectiveDate.getTime())) {
    throw new Error("A valid amendment date is required");
  }
  if (!["add", "remove", "update"].includes(changeType)) {
    throw new Error("Invalid amendment changeType");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Amendment items must be a non-empty array");
  }

  const normalizedItems = items.map((item, index) => {
    if (!mongoose.Types.ObjectId.isValid(String(item?.assetId))) {
      throw new Error(`Invalid assetId for amendment item ${index}`);
    }
    if (typeof item.deltaValue !== "number" || !Number.isFinite(item.deltaValue)) {
      throw new Error(`deltaValue must be numeric for amendment item ${index}`);
    }
    return { ...item, assetId: mongoose.Types.ObjectId.createFromHexString(String(item.assetId)) };
  });

  return {
    date: effectiveDate,
    description,
    changeType,
    items: normalizedItems,
    totalDelta: normalizedItems.reduce((sum, item) => sum + item.deltaValue, 0),
  };
}

export function transitionAmendment(contract, idx, nextStatus, actorId, options = {}) {
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);
  assertTransition(amendment.status, nextStatus, AMENDMENT_TRANSITIONS, "amendment status");

  amendment.status = nextStatus;
  const audit = AUDIT_FIELDS[nextStatus];
  if (audit) {
    amendment[audit[0]] = new Date();
    amendment[audit[1]] = actorObjectId(actorId);
  }
  if (nextStatus === "declined") amendment.declineReason = options.reason || "";
  return amendment;
}

export function applyApprovedAmendmentToContract(contract, idx, actorId) {
  const amendment = contract.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);
  if (!amendment.amendmentNumber) {
    throw new Error("Amendment must have a number before it can be applied");
  }

  const impact = computeAmendmentImpact(contract.toObject({ depopulate: true }), idx);
  contract.totalValue = Number(impact.nextContract.totalValue ?? 0);
  contract.coveredAssets = Array.isArray(impact.nextContract.coveredAssets)
    ? impact.nextContract.coveredAssets
    : [];
  transitionAmendment(contract, idx, "applied", actorId);
  return impact;
}
