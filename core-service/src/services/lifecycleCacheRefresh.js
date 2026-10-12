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
  beforePersist,
  reportFailures = false,
  reportCoverage = false
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
  if (reportFailures) counts.failures = [];
  const consideredIds = [];
  async function finish() {
    // Beginning-to-end bounded members, never an atomic or partial-fleet snapshot.
    if (reportCoverage && afterId === null && counts.nextCursor === null) {
      const coverage = { scope: 'completed_traversal_members', sampledAt: null,
        consideredPopulation: counts.processed, eligibleObserved: 0, unavailable: 0,
        fresh: 0, stale: 0, missing: 0, unsupported: 0, isAtomicSnapshot: false };
      try {
        for (let i = 0; i < consideredIds.length; i += pageSize) {
          const ids = consideredIds.slice(i, i + pageSize);
          const members = await Asset.find({ ...scope, _id: { $in: ids },
            deletedAt: null, isArchived: { $ne: true } }).lean();
          coverage.unavailable += ids.length - members.length;
          coverage.eligibleObserved += members.length;
          for (const row of await cache.inspectPage(members)) coverage[row.state.state]++;
        }
        coverage.sampledAt = new Date().toISOString();
        counts.coverage = coverage;
      } catch (_) { counts.coverage = { scope: 'unavailable', reason: 'coverage_query_failed' }; }
    }
    return counts;
  }
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
        return await finish();
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
      for (const asset of assets) {
        const assetId = String(asset._id), reported = outcomes.get(assetId);
        const outcome = ['refreshed', 'skipped', 'failed', 'conflict', 'expired'].includes(reported) ? reported : 'failed';
        counts[outcome]++;
        if (counts.outcomes) counts.outcomes.push({ assetId, outcome });
        if (reportFailures && ['failed', 'conflict', 'expired'].includes(outcome)) counts.failures.push({ assetId, outcome });
        if (reportCoverage) consideredIds.push(asset._id);
      }
      counts.processed += assets.length;
      cursor = String(assets.at(-1)._id);
      counts.nextCursor = cursor;
    }
    if (assetIds !== null && counts.outcomes.length === new Set(assetIds.map(String)).size) {
      counts.nextCursor = null;
      return await finish();
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
    return await finish();
  } catch (_) {
    // Preserve completed pages on a query/connection error; remaining exact members
    // have unknown/not-attempted outcomes, never implicit success. Do not expose DB errors.
    counts.state = 'incomplete';
    counts.reason = 'bounded_refresh_query_failed';
    counts.hasMore = null; // Unknown remaining traversal, never a completed tail.
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
