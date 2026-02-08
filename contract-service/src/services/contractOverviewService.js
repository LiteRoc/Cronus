// src/services/contractOverviewService.js
import mongoose from "mongoose";
import Contract from "../models/Contract.js";

const laborHoursFromTimeLogs = (logs = []) => {
  if (!Array.isArray(logs)) return 0;
  // timeSpent is minutes
  return logs.reduce((sum, l) => sum + (Number(l.timeSpent || 0) / 60), 0);
};

const travelHoursFromTravelLogs = (logs = []) => {
  if (!Array.isArray(logs)) return 0;
  // travelTime is minutes
  return logs.reduce((sum, l) => sum + (Number(l.travelTime || 0) / 60), 0);
};

const asNumber = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const daysBetweenUTC = (start, end) => {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  return Math.max(0, Math.ceil((e - s) / (24 * 60 * 60 * 1000)));
};

const overlapDaysUTC = (rangeStart, rangeEnd, segStart, segEnd) => {
  const s = new Date(Math.max(rangeStart.getTime(), segStart.getTime()));
  const e = new Date(Math.min(rangeEnd.getTime(), segEnd.getTime()));
  if (e <= s) return 0;
  return daysBetweenUTC(s, e);
};

// Pro-rate an annual cost across a date range (simple day-based proration)
const prorateAnnualCost = (annualCost, rangeStart, rangeEnd, segStart, segEnd) => {
  const overlapDays = overlapDaysUTC(rangeStart, rangeEnd, segStart, segEnd);
  if (overlapDays <= 0) return 0;
  const daily = asNumber(annualCost, 0) / 365.25;
  return daily * overlapDays;
};

async function fetchWorkOrdersAnalytics(coreClient, assetIds, startISO, endISO) {
  if (!assetIds?.length) return [];
  const { data } = await coreClient.get("/workorders", {
    params: {
      assetIds: assetIds.join(","),
      start: startISO,
      end: endISO,
      dateField: "requestDate",
      mode: "analytics",
    },
  });
  return data?.items ?? [];
}

async function fetchAssetsBatch(coreClient, assetIds) {
  if (!assetIds?.length) return [];
  const { data } = await coreClient.post("/assets/batch", { assetIds });
  // core returns { assets: [...] }
  return data?.assets ?? [];
}

// Core analytics engine used by both contract overview + vendorLink overview
export async function buildAssetAnalyticsOverview({
  coreClient,
  assetIds,
  rangeStart,
  rangeEnd,
  laborRate,
  travelRate,
}) {
  const workOrders = await fetchWorkOrdersAnalytics(
    coreClient,
    assetIds,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  const totalWOs = workOrders.length;

  const byAsset = new Map();
  const ensure = (assetId) => {
    if (!byAsset.has(assetId)) {
      byAsset.set(assetId, {
        assetId,
        woCount: 0,
        partsCost: 0,
        laborMinutes: 0,
        travelMinutes: 0,
      });
    }
    return byAsset.get(assetId);
  };

  for (const wo of workOrders) {
    const aId = String(wo.assetId);
    const row = ensure(aId);
    row.woCount += 1;

    const parts = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
    row.partsCost += parts.reduce((s, p) => s + (p.extendedPrice || 0), 0);

    const tls = Array.isArray(wo.timeLogs) ? wo.timeLogs : [];
    row.laborMinutes += tls.reduce((s, t) => s + (t.timeSpent || 0), 0);

    const trls = Array.isArray(wo.travelLogs) ? wo.travelLogs : [];
    row.travelMinutes += trls.reduce((s, t) => s + (t.travelTime || 0), 0);
  }

  const openCount = workOrders.filter((wo) => wo.status !== "Closed" && !wo.closedAt).length;
  const closedCount = workOrders.filter((wo) => wo.status === "Closed" || wo.closedAt).length;

  const avgResponse =
    totalWOs > 0
      ? Math.round((workOrders.reduce((s, w) => s + (w.responseTimeHours || 0), 0) / totalWOs) * 10) /
        10
      : 0;

  const pmWOs = workOrders.filter((wo) => wo.type === "PM" || wo.workOrderType === "Preventive Maintenance");
  const completedPMs = pmWOs.filter((wo) => wo.closedAt || wo.status === "Closed").length;
  const overduePMs = pmWOs.filter(
    (wo) => !(wo.closedAt || wo.status === "Closed") && wo.dueDate && new Date(wo.dueDate) < new Date()
  ).length;

  const pmCompliance = pmWOs.length > 0 ? Math.round((completedPMs / pmWOs.length) * 100) : 100;

  const allParts = workOrders.flatMap((wo) => wo.partsUsed || []);
  const partsUsed = allParts.length;
  const partsCost = allParts.reduce((s, p) => s + (p.extendedPrice || 0), 0);

  const laborHoursYTD = workOrders.reduce((s, wo) => s + laborHoursFromTimeLogs(wo.timeLogs), 0);
  const travelHoursYTD = workOrders.reduce((s, wo) => s + travelHoursFromTravelLogs(wo.travelLogs), 0);

  const laborCostYTD = laborHoursYTD * laborRate;
  const travelCostYTD = travelHoursYTD * travelRate;

  const assetCosts = Array.from(byAsset.values())
    .map((r) => {
      const laborHours = r.laborMinutes / 60;
      const travelHours = r.travelMinutes / 60;
      const laborCost = laborHours * laborRate;
      const travelCost = travelHours * travelRate;

      return {
        assetId: r.assetId,
        woCount: r.woCount,
        partsCost: Number(r.partsCost.toFixed(2)),
        laborHours: Number(laborHours.toFixed(2)),
        travelHours: Number(travelHours.toFixed(2)),
        laborCost: Number(laborCost.toFixed(2)),
        travelCost: Number(travelCost.toFixed(2)),
        totalCost: Number((r.partsCost + laborCost + travelCost).toFixed(2)),
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  const costToServeYTD = partsCost + laborCostYTD + travelCostYTD;

  return {
    workOrders,
    assetCosts,
    workOrdersSummary: {
      totalYTD: totalWOs,
      avgResponseTimeHours: avgResponse,
      openCount,
      closedCount,
    },
    pmSummary: {
      compliancePercent: pmCompliance,
      dueThisYear: pmWOs.length,
      completedThisYear: completedPMs,
      overdue: overduePMs,
    },
    parts: {
      totalUsed: partsUsed,
      totalPartCost: Number(partsCost.toFixed(2)),
    },
    labor: {
      hoursYTD: Number(laborHoursYTD.toFixed(2)),
      costYTD: Number(laborCostYTD.toFixed(2)),
      blendedRate: laborRate,
    },
    travel: {
      hoursYTD: Number(travelHoursYTD.toFixed(2)),
      costYTD: Number(travelCostYTD.toFixed(2)),
      blendedRate: travelRate,
    },
    performance: {
      costToServeYTD: Number(costToServeYTD.toFixed(2)),
    },
  };
}

export { prorateAnnualCost };

export const getContractOverviewService = async ({
  contractId,
  tenantFilter,
  user,
  coreClient,
}) => {
  // 1) Contract
  const contract = await Contract.findOne({ _id: contractId, ...tenantFilter }).lean();
  if (!contract) return null;

  // 2) Covered assets (IDs)
  const coveredAssetsIds = (contract.coveredAssets || [])
    .map(String)
    .filter((id) => id && id !== "undefined" && id !== "null");

  // 3) Fetch work orders (Option A: by contractId + contract date range)
  const now = new Date();
  const contractStart = contract.startDate ? new Date(contract.startDate) : null;
  const contractEnd = contract.endDate ? new Date(contract.endDate) : null;

  const rangeStart = contractStart || new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
  const rangeEnd = contractEnd && contractEnd < now ? contractEnd : now;

  let workOrders = [];
  const { data } = await coreClient.get(`/workorders/by-contract/${contractId}`, {
    params: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
      dateField: "requestDate",
    },
  });

  workOrders = data?.workOrders ?? [];

  // 4) Fetch asset details from core-service (you already do this; keep it)
  let assets = [];
  if (coveredAssetsIds.length) {
    try {
      const { data } = await coreClient.post("/assets/batch", { assetIds: coveredAssetsIds });
      assets = Array.isArray(data) ? data : (data?.assets ?? []);
    } catch (e) {
      console.warn("assets/batch failed (overview continues):", e?.response?.data ?? e.message);
      assets = [];
    }
  }

  // 5) Metrics

  // Asset Stats
  const byAsset = new Map();

  const ensure = (assetId) => {
    if (!byAsset.has(assetId)) {
      byAsset.set(assetId, {
        assetId,
        woCount: 0,
        partsCost: 0,
        laborMinutes: 0,
        travelMinutes: 0,
      });
  }
  return byAsset.get(assetId);
  };

  // Work Order Stats
  const totalWOs = workOrders.length;

  for (const wo of workOrders) {
    const aId = String(wo.assetId);
    const row = ensure(aId);
    row.woCount += 1;

    // Parts
    const parts = Array.isArray(wo.partsUsed) ? wo.partsUsed : [];
    row.partsCost += parts.reduce((s, p) => s + (p.extendedPrice || 0), 0);

    // Labor minutes
    const tls = Array.isArray(wo.timeLogs) ? wo.timeLogs : [];
    row.laborMinutes += tls.reduce((s, t) => s + (t.timeSpent || 0), 0);

    // Travel minutes
    const trls = Array.isArray(wo.travelLogs) ? wo.travelLogs : [];
    row.travelMinutes += trls.reduce((s, t) => s + (t.travelTime || 0), 0);
  }

  const last30Days = workOrders.filter(
    (wo) => new Date(wo.requestDate || wo.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const openCount = workOrders.filter(
    (wo) => wo.status !== "Completed" && wo.status !== "Archived"
  ).length;
  const closedCount = workOrders.filter(
    (wo) => wo.status === "Completed"
  ).length;

  const avgResponse =
    totalWOs > 0
      ? Math.round(
          (workOrders.reduce((s, w) => s + (w.responseTimeHours || 0), 0) / totalWOs) * 10
        ) / 10
      : 0;

  // PM Summary
  const pmWOs = workOrders.filter((wo) => wo.type === "PM" || wo.workOrderType === "Preventive Maintenance");
  const completedPMs = pmWOs.filter(
    (wo) => wo.completionDate || wo.closedAt || wo.status === "Completed"
  ).length;
  const overduePMs = pmWOs.filter(
    (wo) =>
      !(wo.completionDate || wo.closedAt || wo.status === "Completed") &&
      wo.dueDate &&
      new Date(wo.dueDate) < new Date()
  ).length;

  const pmCompliance =
    pmWOs.length > 0 ? Math.round((completedPMs / pmWOs.length) * 100) : 100;

  // Parts Summary
  const allParts = workOrders.flatMap((wo) => wo.partsUsed || []);
  const partsUsed = allParts.length;
  const partsCost = allParts.reduce((s, p) => s + (p.extendedPrice || 0), 0);

  // Labor + travel

  const laborRate = Number(process.env.BLENDED_LABOR_RATE || 135);
  const travelRate = Number(process.env.BLENDED_TRAVEL_RATE || laborRate);

  const assetCosts = Array.from(byAsset.values()).map((r) => {
    const laborHours = r.laborMinutes / 60;
    const travelHours = r.travelMinutes / 60;

    const laborCost = laborHours * laborRate;
    const travelCost = travelHours * travelRate;

    return {
      assetId: r.assetId,
      woCount: r.woCount,
      partsCost: Number(r.partsCost.toFixed(2)),
      laborHours: Number(laborHours.toFixed(2)),
      travelHours: Number(travelHours.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      travelCost: Number(travelCost.toFixed(2)),
      totalCost: Number((r.partsCost + laborCost + travelCost).toFixed(2)),
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  const laborHoursYTD = workOrders.reduce(
    (s, wo) => s + laborHoursFromTimeLogs(wo.timeLogs),
    0
  );

  const travelHoursYTD = workOrders.reduce(
    (s, wo) => s + travelHoursFromTravelLogs(wo.travelLogs),
    0
  );
  
  const laborCostYTD = laborHoursYTD * laborRate;
  const travelCostYTD = travelHoursYTD * travelRate;

  const costToServeYTD = partsCost + laborCostYTD + travelCostYTD;

  // Asset Enrichment
  const enrichedAssets = assets.map((a) => ({
    _id: a._id,
    ctrlNumber: a.ctrlNumber,
    manufacturer: a.manufacturer,
    model: a.model,
    serialNumber: a.serialNumber ?? "",
    age: a.manufactureDate
      ? Math.floor((Date.now() - new Date(a.manufactureDate)) / (365.25 * 24 * 60 * 60 * 1000))
      : null,
  }));
  
  // 5.5) Vendor Links enrichment (UI-ready)
  let vendorLinks = Array.isArray(contract.vendorLinks) ? contract.vendorLinks : [];

  // Fetch vendor name snapshots if missing (optional)
  const vendorIds = [...new Set(vendorLinks.map(vl => String(vl.vendorId)).filter(Boolean))];

  const vendorNameById = new Map();
  await Promise.all(
    vendorIds.map(async (vid) => {
      try {
        const { data: v } = await coreClient.get(`/vendors/${vid}`);
        vendorNameById.set(vid, v?.name ?? "");
      } catch (e) {
        vendorNameById.set(vid, "");
      }
    })
  );

  // Batch fetch ALL assets referenced by vendorLinks (so we don't N+1 calls)
  const vendorAssetIds = [
    ...new Set(
      vendorLinks.flatMap(vl => (vl.coveredAssetIds || []).map(String))
    ),
  ].filter((id) => mongoose.Types.ObjectId.isValid(id));

  let vendorAssets = [];
  if (vendorAssetIds.length) {
    try {
      vendorAssets = await fetchAssetsBatch(coreClient, vendorAssetIds);
    } catch (e) {
      console.warn("vendor assets/batch failed:", e?.response?.data ?? e.message);
      vendorAssets = [];
    }
  }

  const vendorAssetById = new Map(vendorAssets.map(a => [String(a._id), a]));

  const enrichedVendorLinks = vendorLinks.map((vl) => {
    const coveredIds = (vl.coveredAssetIds || []).map(String);

    const coveredAssets = coveredIds
      .map((id) => vendorAssetById.get(id))
      .filter(Boolean)
      .map((a) => ({
        _id: a._id,
        ctrlNumber: a.ctrlNumber ?? "",
        manufacturer: a.manufacturer ?? "",
        model: a.model ?? "",
        serialNumber: a.serialNumber ?? "",
        facilityId: a.facilityId ?? null,
        departmentId: a.departmentId ?? null,
      }));

    return {
      _id: vl._id,
      vendorId: vl.vendorId,
      nameSnapshot: vl.nameSnapshot || vendorNameById.get(String(vl.vendorId)) || "",
      coverageType: vl.coverageType,
      startDate: vl.startDate,
      endDate: vl.endDate,
      annualCost: vl.annualCost ?? 0,
      notes: vl.notes ?? "",
      coveredAssetIds: coveredIds,
      coveredAssetsCount: coveredIds.length,
      coveredAssets, // ✅ UI-ready
    };
  });

  // 6) Response 
  const workOrdersList = workOrders
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.requestDate) - new Date(a.createdAt || a.requestDate))
    .slice(0, 25)
    .map((wo) => ({
      _id: wo._id,
      assetId: wo.assetId,
      workOrderNumber: wo.workOrderNumber,
      type: wo.type || wo.workOrderType,
      status: wo.status,
      createdAt: wo.createdAt || wo.requestDate,
    }));


  return {
    contract: {
      _id: contract._id,
      contractNumber: contract.contractNumber,
      name: contract.name,
      type: contract.type,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      totalValue: contract.totalValue,
      coveredAssets: coveredAssetsIds,

      amendments: contract.amendments ?? [],
      amendmentSeq: contract.amendmentSeq ?? 0,

      vendorLinks: enrichedVendorLinks
    },

    assets: enrichedAssets,
    assetCosts,

    workOrders: {
      totalYTD: totalWOs,
      avgResponseTimeHours: avgResponse,
      openCount,
      closedCount,
    },

    pmSummary: {
      compliancePercent: pmCompliance,
      dueThisYear: pmWOs.length,
      completedThisYear: completedPMs,
      overdue: overduePMs,
    },

    parts: {
      totalUsed: partsUsed,
      totalPartCost: Number(partsCost.toFixed(2)),
    },

    labor: {
      hoursYTD: Number(laborHoursYTD.toFixed(2)),
      costYTD: Number(laborCostYTD.toFixed(2)),
      blendedRate: laborRate,
    },

    travel: {
      hoursYTD: Number(travelHoursYTD.toFixed(2)),
      costYTD: Number(travelCostYTD.toFixed(2)),
      blendedRate: travelRate,
    },

    performance: {
      costToServeYTD: Number(costToServeYTD.toFixed(2)),
    },

    risk: {
      score: 0,
      label: "Watch",
      reasons: [],
    },

    workOrdersList,
  };
};

export const getVendorLinkOverviewService = async ({
  contractId,
  linkId,
  tenantFilter,
  coreClient,
}) => {
  const contract = await Contract.findOne({ _id: contractId, ...tenantFilter }).lean();
  if (!contract) return null;

  if (contract.type !== "customer") {
    return { error: "vendorLinks are only supported on customer contracts" };
  }

  const link = (contract.vendorLinks || []).find((vl) => String(vl._id) === String(linkId));
  if (!link) return { error: "Vendor link not found" };

  const laborRate = Number(process.env.BLENDED_LABOR_RATE || 135);
  const travelRate = Number(process.env.BLENDED_TRAVEL_RATE || laborRate);

  const now = new Date();
  const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));

  const assetIds = (link.coveredAssetIds || [])
    .map(String)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const assets = await fetchAssetsBatch(coreClient, assetIds);
  const enrichedAssets = assets.map((a) => ({
    _id: a._id,
    manufacturer: a.manufacturer,
    model: a.model,
    serialNumber: a.serialNumber ?? "",
    ctrlNumber: a.ctrlNumber ?? "",
    facilityId: a.facilityId ?? null,
    departmentId: a.departmentId ?? null,
  }));

  const analytics = await buildAssetAnalyticsOverview({
    coreClient,
    assetIds,
    rangeStart: ytdStart,
    rangeEnd: now,
    laborRate,
    travelRate,
  });

  return {
    vendorLink: {
      _id: link._id,
      vendorId: link.vendorId,
      nameSnapshot: link.nameSnapshot,
      coverageType: link.coverageType,
      startDate: link.startDate,
      endDate: link.endDate,
      annualCost: link.annualCost ?? 0,
      coveredAssetIds: assetIds,
    },
    assets: enrichedAssets,
    assetCosts: analytics.assetCosts,
    workOrders: analytics.workOrdersSummary,
    pmSummary: analytics.pmSummary,
    parts: analytics.parts,
    labor: analytics.labor,
    travel: analytics.travel,
    performance: analytics.performance,
  };
};

