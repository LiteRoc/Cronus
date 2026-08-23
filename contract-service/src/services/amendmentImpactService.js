const toStr = (value) => (value == null ? "" : value.toString());
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

/**
 * Computes operational coverage impact without rewriting the Contract financial
 * baseline. Amendment deltas are signed financial changes consumed by the value
 * timeline when the amendment is applied.
 */
export function computeAmendmentImpact(contractLike, idx) {
  const amendment = contractLike.amendments?.[idx];
  if (!amendment) throw new Error(`Amendment not found at idx=${idx}`);

  const changeType = amendment.changeType;
  const items = amendment.items ?? [];
  const itemIds = items.map((item) => toStr(item.assetId)).filter(Boolean);
  const totalDelta = typeof amendment.totalDelta === "number" && Number.isFinite(amendment.totalDelta)
    ? amendment.totalDelta
    : items.reduce((sum, item) => sum + asNumber(item.deltaValue), 0);
  const beforeAssets = new Set((contractLike.coveredAssets ?? []).map(toStr));
  let nextAssets = [...beforeAssets];

  if (changeType === "add") {
    for (const id of itemIds) if (!beforeAssets.has(id)) nextAssets.push(id);
  } else if (changeType === "remove") {
    const removed = new Set(itemIds);
    nextAssets = nextAssets.filter((id) => !removed.has(id));
  } else if (changeType !== "update") {
    throw new Error(`Invalid changeType: ${changeType}`);
  }

  const afterAssets = new Set(nextAssets);
  const baseValue = asNumber(contractLike.totalValue);
  return {
    idx,
    changeType,
    totalDelta,
    nextContract: {
      ...contractLike,
      totalValue: baseValue,
      amendments: (contractLike.amendments ?? []).map((amendment) => ({ ...amendment })),
      coveredAssets: nextAssets,
    },
    diff: {
      addedAssetIds: [...afterAssets].filter((id) => !beforeAssets.has(id)),
      removedAssetIds: [...beforeAssets].filter((id) => !afterAssets.has(id)),
      coveredAssetsCountBefore: beforeAssets.size,
      coveredAssetsCountAfter: afterAssets.size,
      totalValueBefore: baseValue,
      totalValueAfter: baseValue,
      totalValueDelta: 0,
      annualValueDelta: totalDelta,
    },
  };
}
