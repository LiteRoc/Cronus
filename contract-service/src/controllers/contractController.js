//src/controllers/contractController.js

import mongoose from "mongoose";
import { 
  getContractOverviewService, 
  getVendorLinkOverviewService,
  buildAssetAnalyticsOverview,
  prorateAnnualCost,
 } from "../services/contractOverviewService.js";
import Contract from '../models/Contract.js';
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { buildTenantFilter } from "../middleware/tenantScope.js";
import { buildCoreLookup } from "../services/coreLookupService.js";
import { makeCoreClient, withForwardedHeaders } from "../services/coreAPIClient.js";
import { generateContractNumber } from "../services/contractNumberService.js";
import { computeAmendmentImpact } from "../services/amendmentImpactService.js";
import { calculateAnnualValueAsOf, proratedValueBetween } from "../services/contractValueService.js";
import { fetchAssetsByIds } from "../services/coreAssetService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));

async function fetchVendorSnapshot(coreClient, vendorId) {
  const { data } = await coreClient.get(`/vendors/${vendorId}`);
  return {
    vendorId: String(vendorId),
    nameSnapshot: data?.name ?? "",
  };
}

// GET - Contract Overview
export const getContractOverview = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId } = req.params;


    const overview = await getContractOverviewService({
      contractId,
      tenantFilter,
      user: req.user,
      //headers: req.headers // needed to forward x-facility-id
      coreClient: req.core, // pass in the scoped Axios instance
    });

    if (!overview) {
      return res.status(404).json({ error: "Contract not found" });
    }

    res.status(200).json(overview);
  } catch (error) {
    console.error("Error generating contract overview:", 
      error?.response?.status,
      error?.response?.data || error
    );
    res.status(500).json({ error: "Failed to fetch contract overview" });
  }
};

// GET - List All Contracts
export const getAllContracts = async (req, res) => {
  console.log('Incoming request for all Contract from:', req.user);
    try {
      const tenantFilter = buildTenantFilter(req);
      console.log('tenantFilter:', tenantFilter);

      const contracts = await Contract.find(tenantFilter).lean();
    
    console.log(`Found ${contracts.length} contracts`);
    res.status(200).json(contracts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
};

// GET - Asset ContractId for Work Orders
export const getAssetContract = async (req, res) => {
  try {
    console.log('Mongoose DB name:', mongoose.connection.name);
    console.log("x-facility-id header:", req.headers['x-facility-id']);

    const { assetId } = req.params;
    const dateParam = req.query.date || new Date();
    const date = new Date(dateParam);
    date.setUTCHours(0, 0, 0, 0); // 🛠 force 00:00 UTC

    console.log('Matching assetId:', assetId, '| Type:', typeof assetId);
    console.log('Query date:', date.toISOString());

    const contract = await Contract.findOne({
      coveredAssets: mongoose.Types.ObjectId.createFromHexString(assetId),
      status: 'active',
      $expr: {
        $and: [
          { $lte: ['$startDate', date] },
          { $gte: ['$endDate', date] }
        ]
      }
    })
    .select('_id name startDate endDate type')
    .lean();

    if (!contract) {
      console.log('No matching contract found for asset/date.');
      const fallback = await Contract.find({
        coveredAssets: assetId.toString(),
        status: 'active'
      }).select('startDate endDate name _id').lean();
      console.log('Possible contracts:', fallback);
      return res.json({ contractId: null });
    }

    console.log('Matched contract:', contract._id);
    res.json({ contractId: contract._id });
  } catch (err) {
    console.error('Error in getAssetContract:', err);
    res.status(500).json({ error: 'Failed to lookup asset contract' });
  }
};

// GET - Asset Coverage
export const getAssetCoverage = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { assetId } = req.params;

    const lookup = buildCoreLookup(req.core);
    const assetObjectId = mongoose.Types.ObjectId.createFromHexString(assetId);

    // Parse + normalize date
    const dateParam = req.query.date || new Date();
    const asOf = new Date(dateParam);

    if (Number.isNaN(asOf.getTime())) {
      return res.status(400).json({ error: "Invalid date query param" });
    }

    asOf.setUTCHours(0, 0, 0, 0); // normalize to 00:00 UTC

    // 1) Find the active contract (as-of date) that currently covers this asset
    const activeContract = await Contract.findOne({
      ...tenantFilter,
      status: "active",
      coveredAssets: assetObjectId,
      $expr: {
        $and: [{ $lte: ["$startDate", asOf] }, { $gte: ["$endDate", asOf] }],
      },
    })
      .select("_id name type linkedVendor linkedCustomer startDate endDate status totalValue")
      .lean();

    // 2) Find any contracts that have ever referenced this asset
    const contractsTouchingAsset = await Contract.find({
      ...tenantFilter,
      $or: [{ coveredAssets: assetObjectId }, { "amendments.items.assetId": assetObjectId }],
    })
      .select("_id name status startDate endDate amendments")
      .lean();

    // 3) Build amendment “receipt” timeline for just this asset
    const amendmentHistory = contractsTouchingAsset
      .flatMap((c) =>
        (c.amendments || []).flatMap((am, idx) => {
          const matchingItems = (am.items || []).filter(
            (it) => it.assetId?.toString() === assetId
          );
          if (!matchingItems.length) return [];

          const itemDelta = matchingItems.reduce((sum, it) => sum + (it.deltaValue || 0), 0);

          return [
            {
              contractId: c._id.toString(),
              contractName: c.name,

              amendmentIndex: idx,
              amendmentDate: am.date,
              amendmentStatus: am.status || null,
              changeType: am.changeType,
              description: am.description || "",

              itemDelta,
              items: matchingItems,
            },
          ];
        })
      )
      .sort((a, b) => {
        const da = a.amendmentDate ? new Date(a.amendmentDate).getTime() : 0;
        const db = b.amendmentDate ? new Date(b.amendmentDate).getTime() : 0;
        return da - db;
      });

    // 4) Hydrate customer/vendor display names for the active contract (if present)
    let activeContractHydrated = null;

    if (activeContract) {
      const [linkedCustomerName, linkedVendorName] = await Promise.all([
        lookup("customer", activeContract.linkedCustomer),
        lookup("vendor", activeContract.linkedVendor),
      ]);

      activeContractHydrated = {
        ...activeContract,
        linkedCustomer: activeContract.linkedCustomer || null,
        linkedCustomerName,
        linkedVendor: activeContract.linkedVendor || null,
        linkedVendorName,
      };
    }

    return res.json({
      assetId,
      asOfDate: asOf.toISOString(),
      isCovered: Boolean(activeContractHydrated),

      activeContract: activeContractHydrated,

      contractsTouchingAsset: contractsTouchingAsset.map((c) => ({
        _id: c._id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
      })),

      amendmentHistory,
    });
  } catch (err) {
    console.error("getAssetCoverage failed:", err);
    return res.status(500).json({ error: "Failed to get asset coverage" });
  }
};

// GET - Get a single Contract
export const getOneContract =  async (req, res) => {
    try {
      //console.log("Incoming request for contract:", req.params.id);
      const tenantFilter = buildTenantFilter(req);
      const { id } = req.params;

      const contract = await Contract.findOne({
        _id: id,
        ... tenantFilter
      }).lean();
      if (!contract) return res.status(404).json({ error: 'Contract not found' });

      res.status(200).json(contract);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch contract' });
  }
};

// POST - Create Contract
export const createContract = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { facilityId } = tenantFilter;

    const contractNumber = await generateContractNumber();

    const {
      name,
      type,
      linkedVendor,
      linkedCustomer,
      startDate,
      endDate,
      totalValue,
      coveredAssets,
      // amendments   // 🚫 don’t accept on create for now
    } = req.body;

    if (!name || !type || !startDate || !endDate || typeof totalValue !== "number") {
      return res.status(400).json({ error: "Missing required fields (name, type, startDate, endDate, totalValue)." });
    }

    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ error: "Invalid startDate or endDate." });
    }
    if (e < s) {
      return res.status(400).json({ error: "endDate must be after startDate." });
    }

    const newContract = new Contract({
      contractNumber,
      name,
      type,
      linkedVendor: linkedVendor || null,
      linkedCustomer: linkedCustomer || null,
      startDate: s,
      endDate: e,
      totalValue: 0,
      coveredAssets: Array.isArray(coveredAssets) ? coveredAssets : [],
      amendmentSeq: 0,
      amendments: [],

      facilityId,
      createdBy: req.user.userId,

      // 🔒 lifecycle: always draft on creation
      status: "draft",
    });

    await newContract.save();

    return res.status(201).json({
      message: "Contract created successfully",
      contract: newContract,
    });
  } catch (error) {
    console.error("Error creating contract:", error);
    return res.status(500).json({ error: "Failed to create contract" });
  }
};

// POST - Submit Contract
export const submitContract = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "draft" && contract.status !== "in_review") {
      return res.status(400).json({ error: `Contract must be draft/in_review to submit (current: ${contract.status})` });
    }

    contract.status = "submitted";
    contract.submittedAt = new Date();
    contract.submittedBy = req.user.userId;

    await contract.save();
    return res.json(contract);
  } catch (err) {
    console.error("submitContract failed:", err);
    return res.status(500).json({ error: "Failed to submit contract" });
  }
};

// POST - Approve Contract
export const approveContract = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "submitted") {
      return res.status(400).json({ error: `Contract must be submitted to approve (current: ${contract.status})` });
    }

    contract.status = "approved";
    contract.approvedAt = new Date();
    contract.approvedBy = req.user.userId;

    await contract.save();
    return res.json(contract);
  } catch (err) {
    console.error("approveContract failed:", err);
    return res.status(500).json({ error: "Failed to approve contract" });
  }
};

// POST - Decline Contract
export const declineContract = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "submitted") {
      return res.status(400).json({ error: `Contract must be submitted to decline (current: ${contract.status})` });
    }

    const { reason } = req.body;

    contract.status = "declined";
    contract.declinedAt = new Date();
    contract.declinedBy = req.user.userId;
    contract.declineReason = reason || "";

    await contract.save();
    return res.json(contract);
  } catch (err) {
    console.error("declineContract failed:", err);
    return res.status(500).json({ error: "Failed to decline contract" });
  }
};

// POST - Terminate Contract
export const terminateContract = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "active") {
      return res.status(400).json({ error: `Only active contracts can be terminated (current: ${contract.status})` });
    }

    const { reason } = req.body;

    contract.status = "terminated";
    contract.terminatedAt = new Date();
    contract.terminatedBy = req.user.userId;
    contract.terminationReason = reason || "";

    await contract.save();
    return res.json(contract);
  } catch (err) {
    console.error("terminateContract failed:", err);
    return res.status(500).json({ error: "Failed to terminate contract" });
  }
};

// PUT - Update a existing Contract
// Deprecated 
/*export const updateContract = async (req, res) => {
    try {
    const updated = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Contract not found' });
    res.status(200).json({ message: 'Contract updated', contract: updated });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update contract', details: err.message });
  }
};*/

// PATCH - Add an Amendment to a contract
// Deprecated 
export const addAmendment = async (req, res) => {
  return res.status(410).json({ error: "Deprecated endpoint. Use /amendments/draft + submit/approve/apply." });  
  try {
    const { date, description, changeType, assetId, financialChange } = req.body;
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    contract.amendments.push({ date, description, changeType, assetId, financialChange });

    // Optionally update coveredAssets and totalValue
    if (changeType === 'add') {
      contract.coveredAssets.push(assetId);
      if (financialChange) contract.totalValue += financialChange;
    }
    if (changeType === 'remove') {
      contract.coveredAssets = contract.coveredAssets.filter(id => id.toString() !== assetId);
      if (financialChange) contract.totalValue -= financialChange;
    }

    await contract.save();
    res.status(200).json({ message: 'Amendment added', contract });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add amendment', details: err.message });
  }
};

// POST - Apply an Amendment to a contract
export const applyAmendment = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);

    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }

    const amendment = contract?.amendments?.[idx];
    if (!amendment) return res.status(404).json({ error: "Amendment not found" });
    if (amendment.status !== "approved") {
      return res.status(400).json({ error: `Amendment must be approved to apply (current: ${amendment.status})` });
    }

    // compute impact from clone
    const plain = contract.toObject({ depopulate: true });
    const impact = computeAmendmentImpact(plain, idx);

    // write the impacted fields back onto the mongoose doc
    contract.totalValue = Number(impact.nextContract.totalValue ?? 0);
    contract.coveredAssets = Array.isArray(impact.nextContract.coveredAssets)
      ? impact.nextContract.coveredAssets
      : [];

    // finally apply + finalize
    contract.amendmentSeq = Number(contract.amendmentSeq ?? 0) + 1;
    amendment.amendmentNumber = `${contract.contractNumber}.${contract.amendmentSeq}`;
    amendment.status = "applied";
    amendment.appliedAt = new Date();
    amendment.appliedBy = req.user.userId;

    // ✅ service owns all mutation + numbering + status changes
    //applyApprovedAmendmentToContract(contract, idx, req.user.userId);

    await contract.save();
    return sendSuccess(res, contract);
  } catch (err) {
    console.error("applyAmendment failed:", err);
    return sendError(res, err, 500);
  }
};

// POST - Create Draft Amendment
export const createDraftAmendment = async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
  const contract = await Contract.findOneAndUpdate(
    { _id: req.params.id, ...tenantFilter },
    { $inc: { amendmentSeq: 1 } },
    { new: true }
  );

  if (!contract) return res.status(404).json({ error: "Contract not found" });

  if (contract.status !== 'draft' && contract.status !== 'approved' && contract.status !== 'active') {
    return res.status(400).json({ error: "Cannot add amendment in this contract state" });
  }

  const { date, description, changeType, items } = req.body;

  if (!date) return res.status(400).json({ error: "date is required" });
  if (!["add","remove","update"].includes(changeType)) return res.status(400).json({ error: "invalid changeType" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });

  const idx = contract.amendments.length - 1;

  contract.amendments.push({
    status: 'draft',
    date,
    description,
    changeType,
    items,
    totalDelta: items.reduce((s, i) => s + i.deltaValue, 0),
    createdBy: req.user.userId,
  });

  await contract.save();
  res.status(201).json({
    amendmentIndex: idx,
    amendmentNumber: contract.amendments[idx].amendmentNumber,
    amendment: contract.amendments[idx],
  });
};

// POST - Submit Amendment
export const submitAmendment = async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
  const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
  console.log('Incoming request to approve amendment:', 
    { contractNumber: contract?.contractNumber, amendmentIdx: req.params.idx }
  );

  if (!contract) return res.status(404).json({ error: "Contract not found" });

  const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }
  const amendment = contract?.amendments[idx];

  //const amendment = contract?.amendments[req.params.idx];

  if (!amendment) return res.status(404).json({ error: "Amendment not found" });
  if (amendment.status !== 'draft')
    return res.status(400).json({ error: "Only draft amendments can be submitted" });

  amendment.status = 'submitted';
  amendment.submittedAt = new Date();
  amendment.submittedBy = req.user.userId;

  await contract.save();
  res.json(contract);
};

// POST - Approve Amendment
export const approveAmendment = async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
  const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
  console.log('Incoming request to approve amendment:', 
    { contractNumber: contract?.contractNumber, amendmentIdx: req.params.idx }
  );

  if (!contract) return res.status(404).json({ error: "Contract not found" });

  const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }
  const amendment = contract?.amendments[idx];
  //const amendment = contract?.amendments[req.params.idx];

  if (!amendment) return res.status(404).json({ error: "Amendment not found" });
  if (amendment.status !== 'submitted')
    return res.status(400).json({ error: "Only submitted amendments can be approved" });

  amendment.status = 'approved';
  amendment.approvedAt = new Date();
  amendment.approvedBy = req.user.userId;

  await contract.save();
  res.json(contract);
};

// POST - Decline Amendment
export const declineAmendment = async (req, res) => {
  const tenantFilter = buildTenantFilter(req);
  const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
  //const contract = await Contract.findById(req.params.id);

  if (!contract) return res.status(404).json({ error: "Contract not found" });

  const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }
  const amendment = contract?.amendments[idx];
  //const amendment = contract?.amendments[req.params.idx];

  if (!amendment) return res.status(404).json({ error: "Amendment not found" });
  if (amendment.status !== 'submitted')
    return res.status(400).json({ error: "Only submitted amendments can be declined" });

  const { reason } = req.body;

  amendment.status = 'declined';
  amendment.declinedAt = new Date();
  amendment.declinedBy = req.user.userId;
  amendment.declineReason = reason || '';

  await contract.save();
  res.json(contract);
}

// DELETE - Delete a Contract
export const deleteContract = async (req,res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const deleted = await Contract.findOneAndDelete({ _id: req.params.id, ...tenantFilter });
    if (!deleted) return res.status(404).json({ error: 'Contract not found' });
    res.status(200).json({ message: 'Contract deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contract' });
  }
};

// POST - Void Amendment (internal cancel)
export const voidAmendment = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }

    const amendment = contract.amendments[idx];
    if (!amendment) return res.status(404).json({ error: "Amendment not found" });

    // Only allow voiding BEFORE application
    if (!["draft", "submitted", "approved"].includes(amendment.status)) {
      return res.status(400).json({
        error: `Cannot void amendment in status "${amendment.status}"`,
      });
    }

    amendment.status = "voided";
    amendment.voidedAt = new Date();
    amendment.voidedBy = req.user.userId;

    await contract.save();
    return res.json(contract);
  } catch (err) {
    console.error("voidAmendment failed:", err);
    return res.status(500).json({ error: "Failed to void amendment" });
  }
};

// GET - Preview Apply Amendment
export const previewApplyAmendment = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);

    const contract = await Contract.findOne({ _id: req.params.id, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Invalid amendment index" });
    }

    const amendment = contract.amendments?.[idx];
    if (!amendment) return res.status(404).json({ error: "Amendment not found" });

    // Plain clone (avoid mutating mongoose doc)
    const plainBefore = contract.toObject({ depopulate: true });

    // Pure impact engine
    const impact = computeAmendmentImpact(plainBefore, idx);

    // impact.diff should include addedAssetsIds/removeAssetIds
    const addedAssetIds = impact?.diff?.addedAssetIds ?? [];
    const removedAssetIds = impact?.diff?.removedAssetIds ?? [];
    //const idsToLookup = [...new Set([...addedIds, ...removedIds])];

    const coreClient = makeCoreClient(req);

    let addedAssets = [];
    let removedAssets = [];

    // enrich via core-service
    try {
      [addedAssets, removedAssets] = await Promise.all([
      fetchAssetsByIds(coreClient, addedAssetIds),
      fetchAssetsByIds(coreClient, removedAssetIds),
    ]);
    } catch (e) {
      console.warn(
        "asset batch lookup failed (preview continues):", 
        e?.response?.data ?? e.message);
    }

    console.log("preview asset enrich:", {
      addedAssetIdsCount: addedAssetIds.length,
      removedAssetIdsCount: removedAssetIds.length,
      addedAssetsCount: addedAssets.length,
      removedAssetsCount: removedAssets.length,
    });

    

    console.log("CORE_API_URL env is:", process.env.CORE_API_URL);
    console.log("coreClient baseURL is:", coreClient.defaults.baseURL);

    /*let diffAssets = [];
    if (idsToLookup.length > 0) {
      const { data: assetData } = await coreClient.post("/assets/batch", {
        assetIds: idsToLookup,
      });
      diffAssets = assetData?.assets ?? [];
    }*/

    //const lookup = new Map(diffAssets.map((a) => [String(a._id), a ]));

    /*const toDesc = (a) => ({
      _id: String(a._id),
      manufacturer: a.manufacturer,
      model: a.model,
      serialNumber: a.serialNumber,
    });*/

    /*const addedAssets = addedIds
      .map((id) => lookup.get(String(id)))
      .filter(Boolean)
      .map(toDesc);*/

    /*const removedAssets = removedIds
      .map((id) => lookup.get(String(id)))
      .filter(Boolean)
      .map(toDesc);*/

    // "After" plain contract (still no DB writes)
    const plainAfter = impact.nextContract;

    const effectiveDate = new Date(amendment.date);
    if (Number.isNaN(effectiveDate.getTime())) {
      return res.status(400).json({ error: "Amendment has invalid date" });
    }

    // Financials as-of effective date (before/after)
    const annualBefore = calculateAnnualValueAsOf(plainBefore, effectiveDate);
    const annualAfter = calculateAnnualValueAsOf(plainAfter, effectiveDate);

    // Remaining term exposure from effective date → contract end
    const endDate = new Date(plainBefore.endDate);
    const remainingBefore = proratedValueBetween(plainBefore, effectiveDate, endDate);
    const remainingAfter = proratedValueBetween(plainAfter, effectiveDate, endDate);

    // UI-friendly summary blocks
    const before = {
      totalValue: Number(plainBefore.totalValue ?? 0),
      coveredAssetsCount: impact.diff.coveredAssetsCountBefore,
      annualValueAsOfEffectiveDate: annualBefore.annualValueAsOf,
      remainingTermValueFromEffectiveDate: remainingBefore,
    };

    const after = {
      totalValue: Number(plainAfter.totalValue ?? 0),
      coveredAssetsCount: impact.diff.coveredAssetsCountAfter,
      annualValueAsOfEffectiveDate: annualAfter.annualValueAsOf,
      remainingTermValueFromEffectiveDate: remainingAfter,
    };

    return sendSuccess(res, {
      contractId: String(contract._id),
      contractNumber: contract.contractNumber ?? null,

      amendmentIndex: idx,
      amendmentStatus: amendment.status ?? null,
      effectiveDate: effectiveDate.toISOString(),
      changeType: impact.changeType,

      // keep these flat for UI convenience
      totalDelta: impact.totalDelta,
      diff: {
        ...impact.diff,
        addedAssetIds,
        removedAssetIds,
        addedAssets,
        removedAssets,
      },

      before,
      after,

      deltas: {
        totalValue: after.totalValue - before.totalValue,
        coveredAssetsCount: after.coveredAssetsCount - before.coveredAssetsCount,
        annualValueAsOfEffectiveDate:
          after.annualValueAsOfEffectiveDate - before.annualValueAsOfEffectiveDate,
        remainingTermValueFromEffectiveDate:
          after.remainingTermValueFromEffectiveDate - before.remainingTermValueFromEffectiveDate,
      },
    });
  } catch (err) {
    console.error("previewApplyAmedment failed:", err);
    return sendError(res, err, 400);
  }
};

// POST - Create a vendor Link
export const addVendorLink = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId } = req.params;

    const {
      vendorId,
      coverageType = "full",
      annualCost = 0,
      startDate,
      endDate,
      coveredAssetIds = [],
      notes
    } = req.body ?? {};

    if (!isValidId(contractId)) return res.status(400).json({ error: "Invalid contractId" });
    if (!isValidId(vendorId)) return res.status(400).json({ error: "Invalid vendorId" });

    const contract = await Contract.findOne({
      _id: contractId,
      ... tenantFilter
    });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.type !== "customer") {
      return res.status(400).json({ error: "vendorLinks are only supported on customer contracts" });
    }

    // validate vendor exists in core-service + snapshot name
    let vendorSnap;
    try {
      vendorSnap = await fetchVendorSnapshot(req.core, vendorId);
    } catch (e) {
      return res.status(400).json({
        error: "Vendor not found in core-service",
        details: e?.response?.data ?? e?.message,
      });
    }

    const cleanAssetIds = (Array.isArray(coveredAssetIds) ? coveredAssetIds : [])
      .map(String)
      .filter(isValidId);

    // prevent duplicate vendor links for same vendor (optional; remove if you want duplicates)
    const alreadyLinked = (contract.vendorLinks ?? []).some(
      (vl) => String(vl.vendorId) === String(vendorId)
    );
    if (alreadyLinked) {
      return res.status(409).json({ error: "Vendor is already linked to this contract "});
    }

    contract.vendorLinks = contract.vendorLinks ?? [];
    contract.vendorLinks.push({
      vendorId: vendorSnap.vendorId,
      nameSnapshot: vendorSnap.nameSnapshot,
      coverageType,
      annualCost: Number(annualCost || 0),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      notes: notes ?? "",
      coveredAssetIds: cleanAssetIds,
      invoices: [],
    });

    await contract.save();
    const created = contract.vendorLinks[contract.vendorLinks.length - 1];
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
      console.error("addVendorLink failed:", err?.response?.data ?? err);
      return res.status(500).json({ error: "Failed to create Vendor Link" });
  }
};

// PATCH - Update Vendor Link
export const updateVendorLink = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId, linkId } = req.params;

    if (!isValidId(contractId)) return res.status(400).json({ error: "Invalid contractId" });
    if (!isValidId(linkId)) return res.status(400).json({ error: "Invalid linkId" });

    const contract = await Contract.findOne({ _id: contractId, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });
    if (contract.type !== "customer") {
      return res.status(400).json({ error: "vendorLinks are only supported on customer contracts" });
    }

    const link = contract.vendorLinks?.id(linkId);
    if (!link) return res.status(404).json({ error: "Vendor link not found" });

    const {
      coverageType,
      annualCost,
      startDate,
      endDate,
      notes,
      // allow changing vendorId? usually no; if yes, validate like addVendorLink
    } = req.body ?? {};

    if (coverageType !== undefined) link.coverageType = coverageType;
    if (annualCost !== undefined) link.annualCost = Number(annualCost || 0);
    if (startDate !== undefined) link.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) link.endDate = endDate ? new Date(endDate) : undefined;
    if (notes !== undefined) link.notes = notes ?? "";

    await contract.save();

    return res.json({ success: true, data: link });
  } catch (error) {
    console.error("updateVendorLink failed:", error?.response?.data ?? error);
    return res.status(500).json({ error: "Failed to update vendor link" });
  }
}

// POST - Add/remove covered assets
// body: { add?: string[], remove?: string[] }
export const updateVendorLinkAssets = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId, linkId } = req.params;

    if (!isValidId(contractId)) return res.status(400).json({ error: "Invalid contractId" });
    if (!isValidId(linkId)) return res.status(400).json({ error: "Invalid linkId" });

    const contract = await Contract.findOne({ _id: contractId, ...tenantFilter });
    if (!contract) return res.status(404).json({ error: "Contract not found" });
    if (contract.type !== "customer") {
      return res.status(400).json({ error: "vendorLinks are only supported on customer contracts" });
    }

    const link = contract.vendorLinks?.id(linkId);
    if (!link) return res.status(404).json({ error: "Vendor link not found" });

    const add = Array.isArray(req.body?.add) ? req.body.add : [];
    const remove = Array.isArray(req.body?.remove) ? req.body.remove : [];

    const addIds = add.map(String).filter(isValidId);
    const removeIds = remove.map(String).filter(isValidId);

    const current = new Set((link.coveredAssetIds ?? []).map((x) => String(x)));

    for (const id of addIds) current.add(id);
    for (const id of removeIds) current.delete(id);

    link.coveredAssetIds = [...current];

    await contract.save();

    return res.json({
      success: true,
      data: {
        linkId: String(link._id),
        coveredAssetIds: link.coveredAssetIds.map(String),
        added: addIds,
        removed: removeIds,
      },
    });
  } catch (error) {
    console.error("updateVendorLinkAssets failed:", error?.response?.data ?? error);
    return res.status(500).json({ error: "Failed to update vendor link assets" });
  }
}

// GET /contracts/:id/vendor-links/:linkId/overview
export const getVendorLinkOverview = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId, linkId } = req.params;

    const result = await getVendorLinkOverviewService({
      contractId,
      linkId,
      tenantFilter,
      coreClient: req.core,
    });

    if (!result) return res.status(404).json({ error: "Contract not found" });
    if (result?.error) return res.status(404).json({ error: result.error });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("getVendorLinkOverview failed:", error?.response?.data ?? error);
    return res.status(500).json({ error: "Failed to fetch vendor link overview" });
  }
};

// GET /contracts/:id/profitability?asOf=YYYY-MM-DD
export const getContractProfitability = async (req, res) => {
  try {
    const tenantFilter = buildTenantFilter(req);
    const { id: contractId } = req.params;

    const contract = await Contract.findOne({ _id: contractId, ...tenantFilter }).lean();
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.type !== "customer") {
      return res.status(400).json({ error: "Profitability is intended for customer contracts" });
    }

    const laborRate = Number(process.env.BLENDED_LABOR_RATE || 135);
    const travelRate = Number(process.env.BLENDED_TRAVEL_RATE || laborRate);

    const now = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
    const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));

    // Customer contract window (for proration)
    const contractStart = contract.startDate ? new Date(contract.startDate) : ytdStart;
    const contractEnd = contract.endDate ? new Date(contract.endDate) : now;

    const contractAssetIds = (contract.coveredAssets || [])
      .map(String)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    // 1) Total cost-to-serve for ALL covered assets (YTD)
    const allAnalytics = await buildAssetAnalyticsOverview({
      coreClient: req.core,
      assetIds: contractAssetIds,
      rangeStart: ytdStart,
      rangeEnd: now,
      laborRate,
      travelRate,
    });

    // 2) Vendor payouts (YTD proration) + leakage cost on vendor-covered assets
    const vendorLinks = Array.isArray(contract.vendorLinks) ? contract.vendorLinks : [];

    let vendorPayoutYTD = 0;
    let vendorCoveredAssetIds = new Set();
    const byVendor = [];

    for (const vl of vendorLinks) {
      const vlStart = vl.startDate ? new Date(vl.startDate) : contractStart;
      const vlEnd = vl.endDate ? new Date(vl.endDate) : contractEnd;

      const payout = prorateAnnualCost(vl.annualCost || 0, ytdStart, now, vlStart, vlEnd);
      vendorPayoutYTD += payout;

      const ids = (vl.coveredAssetIds || [])
        .map(String)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

      ids.forEach((id) => vendorCoveredAssetIds.add(id));

      // leakage = internal cost we still incurred on vendor-covered assets
      const vendorAnalytics = await buildAssetAnalyticsOverview({
        coreClient: req.core,
        assetIds: ids,
        rangeStart: ytdStart,
        rangeEnd: now,
        laborRate,
        travelRate,
      });

      byVendor.push({
        linkId: String(vl._id),
        vendorId: String(vl.vendorId),
        nameSnapshot: vl.nameSnapshot ?? "",
        annualCost: Number(vl.annualCost || 0),
        payoutYTD: Number(payout.toFixed(2)),
        coveredAssetsCount: ids.length,
        workOrdersYTD: vendorAnalytics.workOrdersSummary.totalYTD,
        costToServeYTD: vendorAnalytics.performance.costToServeYTD,
      });
    }

    // 3) Non-vendor internal cost-to-serve (assets NOT covered by any vendor link)
    const nonVendorAssetIds = contractAssetIds.filter((id) => !vendorCoveredAssetIds.has(id));
    const nonVendorAnalytics = await buildAssetAnalyticsOverview({
      coreClient: req.core,
      assetIds: nonVendorAssetIds,
      rangeStart: ytdStart,
      rangeEnd: now,
      laborRate,
      travelRate,
    });

    // 4) Revenue (simple YTD proration of contract.totalValue)
    const revenueYTD = prorateAnnualCost(contract.totalValue || 0, ytdStart, now, contractStart, contractEnd);

    const netYTD =
      revenueYTD - vendorPayoutYTD - nonVendorAnalytics.performance.costToServeYTD;

    const marginPct = revenueYTD > 0 ? (netYTD / revenueYTD) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        asOf: now.toISOString(),
        revenue: {
          annual: Number((contract.totalValue || 0).toFixed(2)),
          ytd: Number(revenueYTD.toFixed(2)),
        },
        vendorPayout: {
          ytd: Number(vendorPayoutYTD.toFixed(2)),
        },
        internalCostToServe: {
          ytd_allAssets: allAnalytics.performance.costToServeYTD,
          ytd_nonVendorAssets: nonVendorAnalytics.performance.costToServeYTD,
          leakage_onVendorAssets: Number(
            (allAnalytics.performance.costToServeYTD - nonVendorAnalytics.performance.costToServeYTD).toFixed(2)
          ),
        },
        net: {
          ytd: Number(netYTD.toFixed(2)),
          marginPct: Number(marginPct.toFixed(1)),
        },
        assets: {
          totalCovered: contractAssetIds.length,
          vendorCovered: vendorCoveredAssetIds.size,
          nonVendorCovered: nonVendorAssetIds.length,
        },
        byVendor,
      },
    });
  } catch (error) {
    console.error("getContractProfitability failed:", error?.response?.data ?? error);
    return res.status(500).json({ error: "Failed to fetch profitability" });
  }
};
