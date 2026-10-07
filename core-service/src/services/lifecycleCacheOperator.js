// Offline administrator tooling. No application startup, scheduler, or alternate writer.
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Facility = require('../models/Facility');
const User = require('../models/User');
const cache = require('./lifecycleCache');
const { refreshLifecycleCaches } = require('./lifecycleCacheRefresh');
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function validateOptions(input) {
  const {mode = 'preview', facilityId, actorId, maxAssets, pageSize = 100, afterId = null, assetIds = []} = input;
  if (!['preview', 'apply'].includes(mode) || !validId(facilityId) || !validId(actorId)) throw Error('Require mode, Facility and administrator IDs');
  if (!Number.isSafeInteger(maxAssets) || maxAssets < 1 || maxAssets > 10000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 250) throw Error('Require maximum 1..10000 and page size 1..250');
  if (!Array.isArray(assetIds) || assetIds.some(v => !validId(v)) || afterId !== null && !validId(afterId)) throw Error('Malformed Asset ID or cursor');
  const ids = [...new Set(assetIds.map(v => v.toLowerCase()))].sort();
  if (ids.length > maxAssets || ids.length && afterId) throw Error('Explicit cohort exceeds maximum or combines IDs with cursor');
  return {mode, facilityId: facilityId.toLowerCase(), actorId: actorId.toLowerCase(), maxAssets, pageSize, afterId, assetIds: ids};
}
async function runLifecycleCacheOperator(input, {asOf = new Date(), beforePersist} = {}) {
  const options = validateOptions(input);
  const {facilityId, actorId, assetIds, maxAssets, pageSize, afterId, mode} = options;
  // OS/database access authenticates the offline caller; actor is checked against current app data.
  // Deliberately narrower than global-admin reads: selected Facility must be assigned to actor.
  const actor = await User.findById(actorId).select('_id role facilityId facilities').lean();
  const allowed = [...(actor?.facilities ?? []), actor?.facilityId].filter(Boolean).map(String);
  if (actor?.role !== 'admin' || !allowed.includes(facilityId)) throw Error('Administrator is not authorized for selected Facility');
  if (!await Facility.exists({_id: facilityId})) throw Error('Selected Facility unavailable');
  const eligible = {facilityId: new mongoose.Types.ObjectId(facilityId), deletedAt: null, isArchived: {$ne: true}};
  const selected = [];
  let cursor = afterId;
  while (selected.length < (assetIds.length || maxAssets)) {
    const filter = {...eligible, ...(assetIds.length || cursor ? {_id: {
      ...(assetIds.length ? {$in: assetIds.map(v => new mongoose.Types.ObjectId(v))} : {}),
      ...(cursor ? {$gt: new mongoose.Types.ObjectId(cursor)} : {})
    }} : {})};
    const page = await Asset.find(filter).sort({_id: 1}).limit(Math.min(pageSize, (assetIds.length || maxAssets) - selected.length)).lean();
    if (!page.length) break;
    selected.push(...page);
    cursor = String(page.at(-1)._id);
  }
  // Preflight the entire exact pilot before any write; unavailable/wrong-Facility/ineligible fail closed.
  if (assetIds.length && selected.length !== assetIds.length) {
    const found = new Set(selected.map(a => String(a._id)));
    const error = Error('Explicit selection unavailable in selected Facility or not refresh-eligible');
    error.result = {state: 'selection_rejected', mode, selected: selected.length, considered: 0,
      outcomes: assetIds.filter(id => !found.has(id)).map(assetId => ({assetId, outcome: 'selection_unavailable'}))};
    throw error;
  }
  const hasMore = !assetIds.length && !!cursor && !!await Asset.exists({...eligible, _id: {$gt: new mongoose.Types.ObjectId(cursor)}});
  const result = {mode, facilityId, actorId, asOf: new Date(asOf).toISOString(), selected: selected.length,
    considered: 0, refreshed: 0, skippedFresh: 0, failed: 0, conflicted: 0, expired: 0,
    nextCursor: hasMore ? cursor : null, hasMore, outcomes: [], state: 'completed'};
  if (mode === 'preview') {
    for (let i = 0; i < selected.length; i += pageSize) {
      for (const row of await cache.inspectPage(selected.slice(i, i + pageSize), asOf)) {
        const eligible = row.evidence.contextValid;
        result.outcomes.push({assetId: String(row.asset._id), facilityId, cacheState: row.state.state,
          cacheReason: row.state.reason, eligible, wouldAttempt: eligible && row.state.state !== 'fresh',
          skipReason: !eligible ? 'facility_context_unavailable' : row.state.state === 'fresh' ? 'fresh' : null});
      }
    }
    result.considered = selected.length;
    return result;
  }
  if (!selected.length) return result;
  // The #8 engine remains the sole writer and revalidates facts with its source recheck/CAS.
  const refreshed = await refreshLifecycleCaches({facilityId, assetIds: selected.map(a => String(a._id)),
    maxAssets: selected.length, pageSize, asOf, beforePersist});
  if (refreshed.state === 'overlap_skipped') return {...result, state: 'overlap_skipped'};
  const outcomes = new Map(refreshed.outcomes.map(row => [row.assetId, row.outcome]));
  for (const asset of selected) {
    const assetId = String(asset._id), outcome = outcomes.get(assetId) ?? 'selection_changed';
    result.outcomes.push({assetId, facilityId, outcome});
    result.considered++;
    result[{refreshed: 'refreshed', skipped: 'skippedFresh', failed: 'failed', conflict: 'conflicted', expired: 'expired', selection_changed: 'failed'}[outcome]]++;
  }
  if (result.failed || result.conflicted || result.expired) result.state = 'incomplete';
  return result;
}
module.exports = {validateOptions, runLifecycleCacheOperator};
