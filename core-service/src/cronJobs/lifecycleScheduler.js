// Independent opt-in registration around the shared #8/#22 writer. No import-time timers.
const cron = require('node-cron');
const mongoose = require('mongoose');
const os = require('os');
const { randomUUID } = require('crypto');
const { refreshLifecycleCaches } = require('../services/lifecycleCacheRefresh');
const { SCHEMA, CALCULATION, ECONOMICS } = require('../services/lifecycleCache');
const { POLICY_VERSION } = require('../services/assetLifecycleAssessment');
const CADENCE = '*/15 * * * *';
const TIMEZONE = 'UTC';
const PAGE_SIZE = 100;
const MAX_ASSETS = 1000;
const versions = { cache: SCHEMA, calculation: CALCULATION, policy: POLICY_VERSION, economics: ECONOMICS };

function createLifecycleScheduler({
  flag = process.env.LIFECYCLE_CACHE_CRON_ENABLED,
  connection = mongoose.connection,
  schedule = cron.schedule,
  refresh = refreshLifecycleCaches,
  log = entry => console.log(JSON.stringify(entry)),
  now = () => new Date(),
  instance = `${os.hostname()}:${process.pid}`,
  runId = randomUUID
} = {}) {
  let cursor = null, active = null, task = null, started = false, stopping = false;
  const emit = (event, data = {}) => log({ job: 'lifecycle-cache', event, timestamp: now().toISOString(), instance, versions, ...data });
  async function execute() {
    const id = runId(), start = now(), previousCursor = cursor;
    emit('run_start', { runId: id, startTimestamp: start.toISOString(), cursor: previousCursor });
    try {
      const result = await refresh({ pageSize: PAGE_SIZE, maxAssets: MAX_ASSETS, afterId: previousCursor,
        reportFailures: true, reportCoverage: true });
      if (result.state === 'overlap_skipped') {
        emit('overlap_skip', { runId: id, activeRun: true, cursor, guard: 'refresh_service' });
        return result;
      }
      cursor = result.nextCursor;
      const end = now();
      emit('run_end', { runId: id, startTimestamp: start.toISOString(), endTimestamp: end.toISOString(),
        durationMs: end - start, state: result.state, considered: result.processed, refreshed: result.refreshed,
        skippedFresh: result.skipped, failed: result.failed, conflicted: result.conflict, expired: result.expired,
        failures: result.failures, reason: result.reason ?? null, remainingOutcomesKnown: result.state !== 'incomplete',
        previousCursor, nextCursor: cursor, hasMore: result.hasMore,
        fleetEnd: result.state === 'completed' && cursor === null, coverage: result.coverage ?? null });
      if (result.state === 'incomplete') emit('run_error', { runId: id, reason: result.reason,
        considered: result.processed, cursor, cursorBehavior: 'resume_after_completed_pages' });
      return result;
    } catch (_) {
      // Never emit raw exception/DB messages, which may contain credentials or records.
      const end = now();
      emit('run_end', { runId: id, startTimestamp: start.toISOString(), endTimestamp: end.toISOString(),
        durationMs: end - start, state: 'incomplete', considered: null, refreshed: null, skippedFresh: null,
        failed: null, conflicted: null, expired: null, previousCursor, nextCursor: cursor,
        fleetEnd: false, remainingOutcomesKnown: false, reason: 'refresh_exception' });
      emit('run_error', { runId: id, startTimestamp: start.toISOString(), endTimestamp: end.toISOString(),
        durationMs: end - start, state: 'incomplete', reason: 'refresh_exception', cursor,
        cursorBehavior: 'retained', remainingOutcomesKnown: false });
      return { state: 'incomplete', reason: 'refresh_exception', nextCursor: cursor };
    }
  }
  function tick() {
    if (!started || flag !== 'true') return Promise.resolve({ state: 'disabled' });
    if (stopping) return Promise.resolve({ state: 'stopped' });
    if (active) {
      emit('overlap_skip', { activeRun: true, cursor, guard: 'scheduler' });
      return Promise.resolve({ state: 'overlap_skipped' });
    }
    if (connection.readyState !== 1) {
      emit('run_error', { reason: 'database_not_ready', cursor, cursorBehavior: 'retained' });
      return Promise.resolve({ state: 'incomplete', reason: 'database_not_ready' });
    }
    active = execute().finally(() => { active = null; });
    return active;
  }
  function register() {
    if (stopping || task) return;
    try {
      task = schedule(CADENCE, tick, { timezone: TIMEZONE, runOnInit: false, recoverMissedExecutions: false });
      emit('registration', { enabled: true, cadence: CADENCE, timezone: TIMEZONE, pageSize: PAGE_SIZE, maxAssets: MAX_ASSETS });
    } catch (_) { emit('registration_error', { reason: 'cron_registration_failed', enabled: false }); }
  }
  function start() {
    if (started || stopping) return;
    started = true;
    if (flag !== 'true') {
      if (flag !== undefined && flag !== '' && flag !== 'false') emit('configuration_warning', { reason: 'invalid_enablement_value' });
      emit('registration', { enabled: false, cadence: CADENCE, timezone: TIMEZONE, pageSize: PAGE_SIZE, maxAssets: MAX_ASSETS });
      return;
    }
    if (connection.readyState === 1) register();
    else {
      emit('registration_wait', { reason: 'database_not_ready' });
      connection.once('connected', register);
    }
  }
  async function stop() {
    stopping = true;
    connection.removeListener('connected', register);
    if (task) task.stop();
    await active;
    emit('stopped', { cursor });
  }
  return { start, stop, tick };
}

let singleton;
function startLifecycleCacheScheduler() {
  if (singleton) return singleton;
  singleton = createLifecycleScheduler();
  singleton.start();
  if (process.env.LIFECYCLE_CACHE_CRON_ENABLED === 'true') {
    // Stop new ticks and drain before restoring normal signal termination.
    for (const signal of ['SIGTERM', 'SIGINT']) {
      process.once(signal, () => {
        singleton.stop().finally(() => process.kill(process.pid, signal));
      });
    }
  }
  return singleton;
}
module.exports = { createLifecycleScheduler, startLifecycleCacheScheduler, refreshLifecycleCaches,
  scheduledRefresh: () => startLifecycleCacheScheduler().tick(),
  recomputeLifecycleForAllAssets: () => startLifecycleCacheScheduler().tick(),
  CADENCE, TIMEZONE, PAGE_SIZE, MAX_ASSETS };
