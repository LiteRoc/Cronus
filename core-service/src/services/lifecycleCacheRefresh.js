const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const cache = require('./lifecycleCache');
let running = false;
async function refreshLifecycleCaches({
  pageSize = 200,
  maxAssets = 1000,
  afterId = null,
  asOf = new Date(),
  facilityId = null,
  assetIds = null,
  beforePersist
} = {}) {
  if (running) return {
    state: 'overlap_skipped',
    processed: 0
  };
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 250 || !Number.isSafeInteger(maxAssets) || maxAssets < 1 || maxAssets > 10000 || afterId && !mongoose.isValidObjectId(afterId)) throw new TypeError('Invalid bounded refresh options');
  if (facilityId && !mongoose.isObjectIdOrHexString(facilityId) || assetIds !== null && (!Array.isArray(assetIds) || assetIds.some(v => !mongoose.isObjectIdOrHexString(v)))) throw new TypeError('Invalid refresh scope');
  running = true;
  const counts = {
    state: 'completed',
    processed: 0,
    refreshed: 0,
    skipped: 0,
    failed: 0,
    conflict: 0,
    expired: 0,
    nextCursor: afterId,
    hasMore: false
  };
  const scope = {
    ...(facilityId ? {facilityId: new mongoose.Types.ObjectId(String(facilityId))} : {}),
    ...(assetIds !== null ? {_id: {$in: [...new Set(assetIds.map(String))].map(v => new mongoose.Types.ObjectId(v))}} : {})
  };
  if (assetIds !== null) counts.outcomes = [];
  try {
    let cursor = afterId;
    while (counts.processed < maxAssets) {
      const filter = {
        ...scope,
        deletedAt: null,
        isArchived: {
          $ne: true
        },
        ...(cursor ? {
          _id: {
            ...(scope._id ?? {}),
            $gt: new mongoose.Types.ObjectId(String(cursor))
          }
        } : {})
      };
      const assets = await Asset.find(filter).sort({
        _id: 1
      }).limit(Math.min(pageSize, maxAssets - counts.processed)).lean();
      if (!assets.length) {
        counts.nextCursor = null;
        return counts;
      }
      let outcomes;
      try {
        outcomes = await cache.materializePage(assets, {
          asOf,
          beforePersist
        });
      } catch (_) {
        outcomes = new Map(assets.map(a => [String(a._id), 'failed']));
      }
      for (const outcome of outcomes.values()) counts[outcome]++;
      if (counts.outcomes) for (const asset of assets) counts.outcomes.push({assetId: String(asset._id), outcome: outcomes.get(String(asset._id)) ?? 'failed'});
      counts.processed += assets.length;
      cursor = String(assets.at(-1)._id);
      counts.nextCursor = cursor;
    }
    if (assetIds !== null && counts.outcomes.length === new Set(assetIds.map(String)).size) {
      counts.nextCursor = null;
      return counts;
    }
    counts.hasMore = !!(await Asset.exists({
      ...scope,
      deletedAt: null,
      isArchived: {
        $ne: true
      },
      _id: {
        ...(scope._id ?? {}),
        $gt: new mongoose.Types.ObjectId(cursor)
      }
    }));
    if (!counts.hasMore) counts.nextCursor = null;
    return counts;
  } catch (_) {
    // Preserve completed pages on a query/connection error; remaining exact members
    // have unknown/not-attempted outcomes, never implicit success. Do not expose DB errors.
    if (!counts.outcomes) throw Error('Bounded refresh query failed');
    counts.state = 'incomplete';
    if (counts.outcomes) {
      const completed = new Set(counts.outcomes.map(row => row.assetId));
      for (const assetId of [...new Set(assetIds.map(String))]) {
        if (!completed.has(assetId)) {counts.outcomes.push({assetId, outcome: 'failed'}); counts.failed++;}
      }
    }
    return counts;
  } finally {
    running = false;
  }
}
module.exports = {
  refreshLifecycleCaches
};
