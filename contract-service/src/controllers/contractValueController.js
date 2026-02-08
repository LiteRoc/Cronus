// src/controllers/contractValueController.js

import { buildTenantFilter } from "../middleware/tenantScope.js";
import Contract from "../models/Contract.js";
import {
  calculateAnnualValueAsOf,
  proratedValueBetween,
  buildAppliedTimeline,
} from "../services/contractValueService.js";

function parseISODateOrThrow(value, field) {
  if (typeof value !== "string") throw new Error(`${field} must be a string (YYYY-MM-DD)`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date: ${value}`);
  return d;
}

export async function getContractValue(req, res) {
  try {
    const { id } = req.params;
    const tenantFilter = buildTenantFilter(req);
    console.log("Incoming request contractId:", id);

    const asOf = req.query.asOf ? parseISODateOrThrow(req.query.asOf, "asOf") : new Date();
    console.log("Incoming request asOf:", asOf);

    const contract = await Contract.findOne({ _id: id, ...tenantFilter }).lean();
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    console.log("Retrieved contract from db:", contract);

    const annual = calculateAnnualValueAsOf(contract, asOf);
    const timeline = buildAppliedTimeline(contract);

    // Optional proration range
    let proratedRangeValue = null;
    if (req.query.rangeStart && req.query.rangeEnd) {
      const rangeStart = parseISODateOrThrow(req.query.rangeStart, "rangeStart");
      const rangeEnd = parseISODateOrThrow(req.query.rangeEnd, "rangeEnd");
      proratedRangeValue = proratedValueBetween(contract, rangeStart, rangeEnd);
    }

    // Remaining term value as-of (optional but super useful)
    const remainingTermValue = proratedValueBetween(contract, asOf, contract.endDate);

    // Build a lookup from effectiveDate+description to amendmentNumber (good enough if dates are unique)
    // Better: your builders should include amendmentId; but this is a fast bridge.
    const amendmentLookup = new Map();
    for (const a of contract.amendments ?? []) {
      const key = `${new Date(a.date).toISOString()}|${a.description ?? ""}|${a.changeType ?? ""}`;
      amendmentLookup.set(key, {
        amendmentId: a._id ? String(a._id) : "",
        amendmentNumber: a.amendmentNumber ?? null,
      });
    }

    const enrichEvent = (e) => {
      const key = `${new Date(e.effectiveDate).toISOString()}|${e.description ?? ""}|${e.changeType ?? ""}`;
      const match = amendmentLookup.get(key);

      return {
        ...e,
        amendmentId: match?.amendmentId ?? (e.amendmentId ? String(e.amendmentId) : ""),
        amendmentNumber: match?.amendmentNumber ?? null,
      };
    };

    return res.json({
      contractId: String(contract._id),
      contractNumber: contract.contractNumber ?? null,
      asOf: asOf.toISOString(),
      annualBase: annual.annualBase,
      annualDeltaApplied: annual.annualDeltaApplied,
      annualValueAsOf: annual.annualValueAsOf,
      remainingTermValue, // prorated from asOf -> endDate
      proratedRangeValue, // if rangeStart+rangeEnd provided
      appliedEventsAsOf: annual.appliedEvents ?? [],
      fullTimeline: timeline.events ?? [],
    });
  } catch (err) {
    return res.status(400).json({ message: err?.message ?? "Bad request" });
  }
}