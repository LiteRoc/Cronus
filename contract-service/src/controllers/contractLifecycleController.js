import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import { buildTenantFilter } from "../middleware/tenantScope.js";

export async function getContractLifecycleIntelligence(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid contract ID" });
    }

    const tenantFilter = buildTenantFilter(req);

    const contract = await Contract.findOne({
      _id: id,
      ...tenantFilter,
    }).lean();

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const coveredAssetIds = new Set();

    for (const assetId of contract.coveredAssets ?? []) {
      coveredAssetIds.add(String(assetId));
    }

    for (const link of contract.vendorLinks ?? []) {
      for (const assetId of link.coveredAssetIds ?? []) {
        coveredAssetIds.add(String(assetId));
      }
    }

    const assetIds = [...coveredAssetIds];

    let assets = [];

    if (assetIds.length > 0) {
    const { data } = await req.core.post("/assets/batch", { assetIds });
    assets = Array.isArray(data) ? data : data?.assets ?? [];
    }

    let replacementRecommendedCount = 0;
    let projectedAnnualMaintenance = 0;
    let currentBookValue = 0;
    let estimatedReplacementValue = 0;
    // data-quality counter:
    let assetsMissingReplacementValue = 0;

    const replacementCandidates = [];

    for (const asset of assets) {
    const metrics = asset.metrics ?? {};

    projectedAnnualMaintenance += Number(metrics.projectedAnnualMaintenance || 0);
    currentBookValue += Number(metrics.currentBookValue || 0);

    const replacementValue =
        Number(asset.purchase?.price || 0) ||
        Number(asset.purchaseCost || 0) ||
        Number(asset.templateId?.benchmark?.averageQuotedPrice || 0);

    estimatedReplacementValue += replacementValue;

    if (replacementValue <= 0) {
        assetsMissingReplacementValue += 1;
    }

    if (metrics.replacementRecommended === true) {
        replacementRecommendedCount += 1;

        replacementCandidates.push({
        _id: String(asset._id),
        ctrlNumber: asset.ctrlNumber,
        manufacturer: asset.manufacturer,
        model: asset.model,
        serialNumber: asset.serialNumber ?? "",
        replacementReason: metrics.replacementReason ?? null,
        yearsInService: metrics.yearsInService ?? null,
        currentBookValue: metrics.currentBookValue ?? 0,
        projectedAnnualMaintenance: metrics.projectedAnnualMaintenance ?? 0,
        estimatedReplacementValue: replacementValue,
        });
    }
    }

    const replacementRecommendedPercent =
    assetIds.length > 0
        ? (replacementRecommendedCount / assetIds.length) * 100
        : 0;

    const roundMoney = (value) => Number(value.toFixed(2));

    return res.json({
        contract: {
            _id: String(contract._id),
            contractNumber: contract.contractNumber,
            name: contract.name,
            status: contract.status,
            type: contract.type,
            startDate: contract.startDate,
            endDate: contract.endDate,
            totalValue: contract.totalValue,
        },
        summary: {
            coveredAssetCount: assetIds.length,
            hydratedAssetCount: assets.length,

            replacementRecommendedCount,

            replacementRecommendedPercent:
            Number(replacementRecommendedPercent.toFixed(1)),

            projectedAnnualMaintenance:
            roundMoney(projectedAnnualMaintenance),

            currentBookValue:
            roundMoney(currentBookValue),

            estimatedReplacementValue:
            roundMoney(estimatedReplacementValue),

            assetsMissingReplacementValue,
        },
        replacementCandidates,
        });
  } catch (err) {
    console.error("GET /contracts/:id/lifecycle-intelligence failed:", err);
    return res.status(500).json({
      message: "Failed to compute contract lifecycle intelligence",
    });
  }
}