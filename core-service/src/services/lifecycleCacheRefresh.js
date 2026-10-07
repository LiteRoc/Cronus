const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const cache = require('./lifecycleCache');
let running = false;
async function refreshLifecycleCaches({
  pageSize = 200,
  maxAssets = 1000,
  afterId = null,
  asOf = new Date(),
  beforePersist
} = {}) {
  if (running) return {
    state: 'overlap_skipped',
    processed: 0
  };
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 250 || !Number.isSafeInteger(maxAssets) || maxAssets < 1 || maxAssets > 10000 || afterId && !mongoose.isValidObjectId(afterId)) throw new TypeError('Invalid bounded refresh options');
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
  try {
    let cursor = afterId;
    while (counts.processed < maxAssets) {
      const filter = {
        deletedAt: null,
        isArchived: {
          $ne: true
        },
        ...(cursor ? {
          _id: {
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
      counts.processed += assets.length;
      cursor = String(assets.at(-1)._id);
      counts.nextCursor = cursor;
    }
    counts.hasMore = !!(await Asset.exists({
      deletedAt: null,
      isArchived: {
        $ne: true
      },
      _id: {
        $gt: new mongoose.Types.ObjectId(cursor)
      }
    }));
    if (!counts.hasMore) counts.nextCursor = null;
    return counts;
  } finally {
    running = false;
  }
}
module.exports = {
  refreshLifecycleCaches
};
