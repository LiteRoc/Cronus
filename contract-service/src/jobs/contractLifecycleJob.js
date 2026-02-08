// src/jobs/contractLifecycleJob.js

import Contract from "../models/Contract.js";
import { applyApprovedAmendmentToContract } from "../services/amendmentLifecycleService.js";

/**
 * Runs lifecycle automation:
 * - contracts: approved->active, active->expired
 * - amendments: approved->applied (when amendment.date <= now)
 */
export async function runContractLifecycleJob({ actorId = null, dryRun = false } = {}) {
  const now = new Date();

  const summary = {
    now: now.toISOString(),
    contractsActivated: 0,
    contractsExpired: 0,
    amendmentsApplied: 0,
    errors: 0,
  };

  // 1) Contract: approved -> active (startDate <= now <= endDate)
  {
    const filter = {
      status: "approved",
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    const candidates = await Contract.find(filter);
    for (const c of candidates) {
      try {
        c.status = "active";
        c.approvedAt = c.approvedAt || now; // optional
        if (!dryRun) await c.save();
        summary.contractsActivated += 1;
      } catch (e) {
        summary.errors += 1;
        console.error("activate contract failed:", c._id?.toString(), e);
      }
    }
  }

  // 2) Contract: active -> expired (endDate < now)
  {
    const filter = {
      status: "active",
      endDate: { $lt: now },
    };

    const candidates = await Contract.find(filter);
    for (const c of candidates) {
      try {
        c.status = "expired";
        if (!dryRun) await c.save();
        summary.contractsExpired += 1;
      } catch (e) {
        summary.errors += 1;
        console.error("expire contract failed:", c._id?.toString(), e);
      }
    }
  }

  // 3) Amendments: approved -> applied (amendment.date <= now)
  // Only apply for contracts that are active.
  {
    const filter = {
      status: "active",
      amendments: { $elemMatch: { status: "approved", date: { $lte: now } } },
    };

    const contracts = await Contract.find(filter);
    for (const c of contracts) {
        let mutated = false;

        for (let i = 0; i < c.amendments.length; i++) {
        const a = c.amendments[i];
        if (a?.status === "approved" && a.date && new Date(a.date) <= now) {
            // apply logic here
            mutated = true;
        }
        }

        if (mutated && !dryRun) await c.save();
    }

    /*for (const c of contracts) {
      try {
        // Apply all eligible approved amendments in order (important!)
        for (let i = 0; i < c.amendments.length; i++) {
          const a = c.amendments[i];
          if (a?.status === "approved" && a.date && new Date(a.date) <= now) {
            applyApprovedAmendmentToContract(c, i, actorId);
            summary.amendmentsApplied += 1;
          }
        }

        if (!dryRun) await c.save();
      } catch (e) {
        summary.errors += 1;
        console.error("apply approved amendments failed:", c._id?.toString(), e);
      }
    }*/
  }

  return summary;
}