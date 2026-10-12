import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { jest } from '@jest/globals';
const require = createRequire(import.meta.url);
const source = name => readFileSync(new URL('../' + name + '.js', import.meta.url), 'utf8');
function harness(globalFlag, lifecycleFlag, readyState = 1) {
  const env = {};
  if (globalFlag !== undefined) env.CRON_ENABLED = globalFlag;
  if (lifecycleFlag !== undefined) env.LIFECYCLE_CACHE_CRON_ENABLED = lifecycleFlag;
  const connection = Object.assign(new EventEmitter(), { readyState });
  const schedule = jest.fn(() => ({ stop: jest.fn() }));
  const log = jest.fn(), refresh = jest.fn();
  const imported = [];
  const schedulerModule = { exports: {} };
  vm.runInNewContext(source('lifecycleScheduler'), {
    require: name => {
      if (name === 'node-cron') return { schedule };
      if (name === 'mongoose') return { connection };
      if (name === '../services/lifecycleCacheRefresh') return { refreshLifecycleCaches: refresh };
      if (name === '../services/lifecycleCache') return { SCHEMA: 'schema', CALCULATION: 'calc', ECONOMICS: 'economics' };
      if (name === '../services/assetLifecycleAssessment') return { POLICY_VERSION: 'policy' };
      return require(name);
    },
    module: schedulerModule, process: { env, pid: 123, once: jest.fn() }, console: { log }
  });
  const indexModule = { exports: {} };
  vm.runInNewContext(source('index'), {
    process: { env }, module: indexModule, console: { log },
    require: name => {
      imported.push(name);
      if (name === './lifecycleScheduler') return schedulerModule.exports;
      if (name === './cronJobs') {
        vm.runInNewContext(source('cronJobs'), {
          require: dep => dep === 'node-cron' ? { schedule } : {},
          module: { exports: {} }, console: { log }
        });
        return {};
      }
      throw Error('Unexpected import');
    }
  });
  return { schedule, log, refresh, imported, connection, starter: indexModule.exports.startLifecycleScheduling,
    factory: schedulerModule.exports.createLifecycleScheduler };
}
test.each([
  ['false', undefined, 0, 0], ['false', 'false', 0, 0], ['false', 'true', 0, 1],
  ['true', 'false', 2, 0], ['true', 'true', 2, 1], ['true', undefined, 2, 0],
  [undefined, undefined, 2, 0], ['malformed-global', 'false', 2, 0]
])('independent registration global=%s lifecycle=%s', (globalFlag, lifecycleFlag, legacy, lifecycle) => {
  const h = harness(globalFlag, lifecycleFlag);
  expect(h.schedule).toHaveBeenCalledTimes(legacy);
  h.starter();
  expect(h.schedule).toHaveBeenCalledTimes(legacy + lifecycle);
  expect(h.schedule.mock.calls.filter(c => c[0] === '0 0 * * *')).toHaveLength(legacy);
  expect(h.schedule.mock.calls.filter(c => c[0] === '*/15 * * * *')).toHaveLength(lifecycle);
  expect(h.imported.includes('./cronJobs')).toBe(legacy > 0);
  expect(h.refresh).not.toHaveBeenCalled();
  if (lifecycle) expect(h.schedule.mock.calls.at(-1)[2]).toEqual({
    timezone: 'UTC', runOnInit: false, recoverMissedExecutions: false
  });
});
test.each(['', '1', 'yes', 'TRUE', 'on', 'random', ' true ', 'false'])('invalid/disabled lifecycle setting stays off: %s', async flag => {
  const h = harness('true', flag); h.starter();
  expect(h.schedule).toHaveBeenCalledTimes(2);
  expect(h.refresh).not.toHaveBeenCalled();
  const events = h.log.mock.calls.filter(c => c[0].startsWith('{')).map(c => JSON.parse(c[0]));
  expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'registration', enabled: false })]));
  expect(events.some(e => e.event === 'configuration_warning')).toBe(!['', 'false'].includes(flag));
  expect(await h.factory({flag}).tick()).toEqual({state: 'disabled'});
});
test('waits for DB readiness, registers once, never refreshes at startup', () => {
  const h = harness('false', 'true', 0); const scheduler = h.starter();
  expect(h.schedule).not.toHaveBeenCalled();
  h.connection.readyState = 1; h.connection.emit('connected'); h.starter();
  expect(h.schedule).toHaveBeenCalledTimes(1); expect(h.refresh).not.toHaveBeenCalled();
  expect(scheduler).toBe(h.starter());
});
test('disabled direct module import creates no timer or refresh', () => {
  const h = harness('false', undefined); expect(h.schedule).not.toHaveBeenCalled(); h.starter();
  expect(h.schedule).not.toHaveBeenCalled(); expect(h.refresh).not.toHaveBeenCalled();
});
const counts = extra => ({state: 'completed', processed: 3, refreshed: 1, skipped: 0, failed: 1,
  conflict: 1, expired: 0, nextCursor: null, hasMore: false, failures: [], ...extra});
function runner(refresh = jest.fn().mockResolvedValue(counts()), extra = {}) {
  const h = harness('false', 'true');
  const log = jest.fn(), schedule = jest.fn(() => ({stop: jest.fn()}));
  const scheduler = h.factory({flag: 'true', connection: h.connection, refresh, schedule, log,
    instance: 'synthetic:123', runId: () => 'synthetic-run', ...extra});
  scheduler.start();
  return {...h, scheduler, log, schedule, refresh};
}
test('synthetic ticks use canonical shared function, 100/1000 bounds, resume then reset', async () => {
  const h = harness('false', 'true');
  h.refresh.mockResolvedValueOnce(counts({nextCursor: '000000000000000000000003', hasMore: true}))
    .mockResolvedValue(counts());
  h.starter(); const tick = h.schedule.mock.calls[0][1];
  await tick(); await tick(); await tick();
  expect(h.refresh.mock.calls.map(c => c[0].afterId)).toEqual([null, '000000000000000000000003', null]);
  expect(h.refresh.mock.calls.every(c => c[0].pageSize === 100 && c[0].maxAssets === 1000
    && c[0].reportFailures && c[0].reportCoverage)).toBe(true);
  expect(h.imported).not.toContain('./cronJobs');
});
test('new process-local scheduler starts at beginning', async () => {
  const h = runner(jest.fn().mockResolvedValue(counts({nextCursor:'000000000000000000000003'}))); await h.scheduler.tick();
  const second = runner(); await second.scheduler.tick();
  expect(second.refresh.mock.calls[0][0].afterId).toBeNull();
});
test('overlap does not invoke refresh or corrupt cursor; later tick proceeds', async () => {
  let release;
  const refresh = jest.fn().mockImplementationOnce(() => new Promise(resolve => {release = resolve;}))
    .mockResolvedValue(counts());
  const h = runner(refresh); const first = h.scheduler.tick();
  expect(await h.scheduler.tick()).toEqual({state: 'overlap_skipped'});
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event: 'overlap_skip', cursor: null}));
  release(counts({nextCursor: '000000000000000000000003', hasMore: true})); await first;
  await h.scheduler.tick();
  expect(refresh.mock.calls[1][0].afterId).toBe('000000000000000000000003');
});
test('service overlap also retains cursor and emits skip', async () => {
  const h = runner(jest.fn().mockResolvedValueOnce(counts({nextCursor: '000000000000000000000003'}))
    .mockResolvedValueOnce({state:'overlap_skipped'}).mockResolvedValue(counts()));
  await h.scheduler.tick(); await h.scheduler.tick(); await h.scheduler.tick();
  expect(h.refresh.mock.calls[2][0].afterId).toBe('000000000000000000000003');
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'overlap_skip',guard:'refresh_service'}));
});
test('exception is sanitized, cursor retained, guard released, later tick retries', async () => {
  const h = runner(jest.fn().mockResolvedValueOnce(counts({nextCursor: '000000000000000000000003'}))
    .mockRejectedValueOnce(Error('secret://business-record')).mockResolvedValue(counts()));
  await h.scheduler.tick(); expect((await h.scheduler.tick()).state).toBe('incomplete'); await h.scheduler.tick();
  expect(h.refresh.mock.calls[2][0].afterId).toBe('000000000000000000000003');
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'run_error', reason:'refresh_exception',cursorBehavior:'retained'}));
  expect(JSON.stringify(h.log.mock.calls)).not.toContain('secret');
});
test('partial query failure preserves returned completed-page progress and terminal counts', async () => {
  const h = runner(jest.fn().mockResolvedValueOnce(counts({state:'incomplete',reason:'bounded_refresh_query_failed',
    nextCursor:'000000000000000000000003',hasMore:null})).mockResolvedValue(counts()));
  await h.scheduler.tick(); await h.scheduler.tick();
  expect(h.refresh.mock.calls[1][0].afterId).toBe('000000000000000000000003');
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'run_end',state:'incomplete',fleetEnd:false,remainingOutcomesKnown:false}));
});
test('logs required terminal telemetry without business payloads', async () => {
  const h = runner(); await h.scheduler.tick();
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'registration',enabled:true,cadence:'*/15 * * * *',timezone:'UTC',pageSize:100,maxAssets:1000}));
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'run_start',instance:'synthetic:123',cursor:null,versions:expect.any(Object)}));
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'run_end',considered:3,refreshed:1,skippedFresh:0,failed:1,conflicted:1,expired:0,
    nextCursor:null,fleetEnd:true,durationMs:expect.any(Number),startTimestamp:expect.any(String),endTimestamp:expect.any(String)}));
});
test('disconnection skips safely and later ready tick proceeds', async () => {
  const h = runner();h.connection.readyState=0;await h.scheduler.tick();expect(h.refresh).not.toHaveBeenCalled();
  h.connection.readyState=1;await h.scheduler.tick();expect(h.refresh).toHaveBeenCalledTimes(1);
});
test('shutdown stops new ticks and waits for current bounded run', async () => {
  let release;
  const h=runner(jest.fn(()=>new Promise(resolve=>{release=resolve;})));
  const active=h.scheduler.tick(),stop=h.scheduler.stop();let drained=false;stop.then(()=>{drained=true;});
  await Promise.resolve();expect(drained).toBe(false);expect(h.schedule.mock.results[0].value.stop).toHaveBeenCalled();
  expect(await h.scheduler.tick()).toEqual({state:'stopped'});
  release(counts());await active;await stop;expect(drained).toBe(true);
});
test('shutdown before readiness cancels deferred registration', async () => {
  const h=harness('false','true',0);const scheduler=h.starter();await scheduler.stop();
  h.connection.readyState=1;h.connection.emit('connected');expect(h.schedule).not.toHaveBeenCalled();
});
test('installed node-cron matcher uses UTC quarter-hours and seconds zero', () => {
  const Matcher=require('node-cron/src/time-matcher');const match=new Matcher('*/15 * * * *','UTC');
  for (const minute of [0,15,30,45]) expect(match.match(new Date('2026-10-12T12:'+String(minute).padStart(2,'0')+':00Z'))).toBe(true);
  for (const time of ['12:14:00','12:15:01','12:16:00']) expect(match.match(new Date('2026-10-12T'+time+'Z'))).toBe(false);
  expect(match.timezone).toBe('UTC');
});
test('actual Core startup invokes lifecycle starter only after DB promise resolves', async () => {
  let ready;const connected=new Promise(resolve=>{ready=resolve;});const start=jest.fn();
  const prefix=readFileSync(new URL('../../../app.js',import.meta.url),'utf8').split("require('./src/models/discriminators")[0];
  vm.runInNewContext(prefix,{require:name=>name==='debug'?()=>()=>{}:name==='dotenv'?{config(){}}:name==='./src/config/db'?()=>connected:
    name==='./src/cronJobs/index'?{startLifecycleScheduling:start}:{},console:{log(){}}});
  expect(start).not.toHaveBeenCalled();ready();await connected;expect(start).toHaveBeenCalledTimes(1);
});
test('cron registration exceptions are sanitized and do not escape into Core startup',()=>{
  const h=runner(undefined,{schedule:()=>{throw Error('private provider message');}});
  expect(JSON.stringify(h.log.mock.calls)).not.toContain('private');
  expect(h.log).toHaveBeenCalledWith(expect.objectContaining({event:'registration_error',enabled:false}));
});
test('Core startup registration failure is contained without raw exception output',async()=>{
  const prefix=readFileSync(new URL('../../../app.js',import.meta.url),'utf8').split("require('./src/models/discriminators")[0];
  const error=jest.fn();
  vm.runInNewContext(prefix,{require:name=>name==='debug'?()=>()=>{}:name==='dotenv'?{config(){}}:
    name==='./src/config/db'?()=>Promise.resolve():name==='./src/cronJobs/index'?{
      startLifecycleScheduling(){throw Error('private runtime value');}
    }:{},console:{log(){},error}});
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  expect(error).toHaveBeenCalledTimes(1);
  expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({event:'registration_error',reason:'startup_registration_failed'});
  expect(error.mock.calls[0][0]).not.toContain('private');
});
