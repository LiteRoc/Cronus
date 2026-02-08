// src/services/amendmentImpactService.js

const toStr = (v) => (v == null ? "" : v.toString());

function normalizeContractShape(contract) {
  return {
    ...contract,
    totalValue: Number(contract.totalValue ?? 0),
    coveredAssets: Array.isArray(contract.coveredAssets) ? contract.coveredAssets.map(toStr) : [],
    amendments: Array.isArray(contract.amendments) ? contract.amendments : [],
  };
}

/**
 * Pure impact engine:
 * - does NOT require approved (preview can run on draft/submitted/approved)
 * - does NOT change amendment status/seq/number
 * - returns a new "next" contract shape + diff
 */
export function computeAmendmentImpact(contractLike, idx) {
  const base = normalizeContractShape(contractLike);
  const amendment = base.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);

  const changeType = amendment.changeType;
  const items = amendment.items || [];
  const itemIds = items.map((i) => toStr(i.assetId)).filter(Boolean);

  const totalDelta =
    typeof amendment.totalDelta === "number"
      ? amendment.totalDelta
      : items.reduce((s, i) => s + (i.deltaValue || 0), 0);

  const beforeAssets = new Set(base.coveredAssets);
  const beforeTotalValue = base.totalValue;

  let nextAssets = [...base.coveredAssets];
  let nextTotalValue = beforeTotalValue;

  if (changeType === "add") {
    for (const id of itemIds) {
      if (!beforeAssets.has(id)) nextAssets.push(id);
    }
    nextTotalValue += totalDelta;
  } else if (changeType === "remove") {
    const removeSet = new Set(itemIds);
    nextAssets = nextAssets.filter((id) => !removeSet.has(id));
    nextTotalValue += totalDelta; // should be negative
  } else if (changeType === "update") {
    nextTotalValue += totalDelta;
  } else {
    throw new Error(`Invalid changeType: ${changeType}`);
  }

  const afterAssets = new Set(nextAssets);

  const addedAssetIds = [...afterAssets].filter((id) => !beforeAssets.has(id));
  const removedAssetIds = [...beforeAssets].filter((id) => !afterAssets.has(id));

  const nextContract = {
    ...contractLike,
    totalValue: nextTotalValue,
    coveredAssets: nextAssets, // string ids (caller can rehydrate to ObjectIds if needed)
  };

  return {
    idx,
    changeType,
    totalDelta,
    nextContract,
    diff: {
      addedAssetIds,
      removedAssetIds,
      coveredAssetsCountBefore: beforeAssets.size,
      coveredAssetsCountAfter: afterAssets.size,
      totalValueBefore: beforeTotalValue,
      totalValueAfter: nextTotalValue,
      totalValueDelta: nextTotalValue - beforeTotalValue,
    },
  };
}