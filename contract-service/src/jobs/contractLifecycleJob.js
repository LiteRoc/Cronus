import Contract from "../models/Contract.js";
import { applyApprovedAmendmentToContract } from "../services/amendmentLifecycleService.js";

function errorEntry(operation, error, { contractId, amendmentNumber } = {}) {
  const entry = {
    operation,
    contractId: contractId ? String(contractId) : undefined,
    amendmentNumber: amendmentNumber || undefined,
    message: error?.message || String(error),
  };
  console.error("[cron] contract lifecycle record failed", entry);
  return entry;
}

function dueAmendmentReferences(contracts, now) {
  return contracts
    .flatMap((contract) => contract.amendments
      .filter((amendment) =>
        amendment.status === "approved" &&
        amendment.date &&
        new Date(amendment.date).getTime() <= now.getTime()
      )
      .map((amendment) => ({
        contractId: String(contract._id),
        amendmentId: String(amendment._id),
        amendmentNumber: amendment.amendmentNumber,
        effectiveAt: new Date(amendment.date).getTime(),
      })))
    .sort((left, right) =>
      left.effectiveAt - right.effectiveAt ||
      left.contractId.localeCompare(right.contractId) ||
      left.amendmentId.localeCompare(right.amendmentId)
    );
}

/**
 * Run lifecycle automation at an exact instant.
 *
 * Boundaries are inclusive for activation/effectivity and exclusive for expiry:
 * startDate <= now <= endDate activates, endDate < now expires, and amendment.date
 * <= now applies. The scheduler timezone controls when this exact-instant check runs;
 * stored dates are not rounded to UTC or local midnight.
 */
export async function runContractLifecycleJob({ actorId = null, dryRun = false, now = new Date() } = {}) {
  const effectiveNow = new Date(now);
  if (Number.isNaN(effectiveNow.getTime())) throw new Error("Lifecycle job requires a valid now value");

  const summary = {
    now: effectiveNow.toISOString(),
    dryRun,
    contractsActivated: 0,
    contractsExpired: 0,
    amendmentsApplied: 0,
    errors: [],
  };

  let activationCandidates = [];
  try {
    activationCandidates = await Contract.find({
      status: "approved",
      startDate: { $lte: effectiveNow },
      endDate: { $gte: effectiveNow },
    });
  } catch (error) {
    summary.errors.push(errorEntry("find-contracts-to-activate", error));
  }

  for (const contract of activationCandidates) {
    try {
      if (!dryRun) {
        contract.status = "active";
        contract.activatedAt = effectiveNow;
        contract.activatedBy = actorId;
        await contract.save();
      }
      summary.contractsActivated += 1;
    } catch (error) {
      summary.errors.push(errorEntry("activate-contract", error, { contractId: contract._id }));
    }
  }

  let expirationCandidates = [];
  try {
    expirationCandidates = await Contract.find({
      status: "active",
      endDate: { $lt: effectiveNow },
    });
  } catch (error) {
    summary.errors.push(errorEntry("find-contracts-to-expire", error));
  }

  for (const contract of expirationCandidates) {
    try {
      if (!dryRun) {
        contract.$locals._systemBypassValidation = true;
        contract.status = "expired";
        contract.expiredAt = effectiveNow;
        contract.expiredBy = actorId;
        await contract.save();
      }
      summary.contractsExpired += 1;
    } catch (error) {
      summary.errors.push(errorEntry("expire-contract", error, { contractId: contract._id }));
    }
  }

  let amendmentContracts = [];
  try {
    amendmentContracts = await Contract.find({
      status: "active",
      amendments: { $elemMatch: { status: "approved", date: { $lte: effectiveNow } } },
    });
  } catch (error) {
    summary.errors.push(errorEntry("find-amendments-to-apply", error));
  }

  for (const reference of dueAmendmentReferences(amendmentContracts, effectiveNow)) {
    try {
      const contract = dryRun
        ? amendmentContracts.find((candidate) => String(candidate._id) === reference.contractId)
        : await Contract.findById(reference.contractId);
      const idx = contract?.amendments.findIndex(
        (amendment) => String(amendment._id) === reference.amendmentId
      );
      const amendment = idx >= 0 ? contract.amendments[idx] : null;

      if (
        !contract ||
        contract.status !== "active" ||
        !amendment ||
        amendment.status !== "approved" ||
        !amendment.date ||
        new Date(amendment.date).getTime() > effectiveNow.getTime()
      ) continue;

      applyApprovedAmendmentToContract(contract, idx, actorId);
      if (!dryRun) await contract.save();
      summary.amendmentsApplied += 1;
    } catch (error) {
      summary.errors.push(errorEntry("apply-amendment", error, reference));
    }
  }

  return summary;
}
