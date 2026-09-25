import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { jest } from '@jest/globals';

const source = name => readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8');
function load(flag) {
  const schedule = jest.fn();
  const log = jest.fn();
  const imported = [];
  function loadJob(name) {
    imported.push(name);
    vm.runInNewContext(source(name.slice(2)), {
      require: dependency => dependency === 'node-cron' ? { schedule } : {},
      module: { exports: {} }, console: { log },
    });
  }
  vm.runInNewContext(source('index'), {
    process: { env: flag === undefined ? {} : { CRON_ENABLED: flag } },
    require: loadJob, console: { log },
  });
  return { schedule, log, imported };
}

test.each([undefined, 'true'])('default/enabled registration remains compatible (%s)', flag => {
  const { schedule, imported } = load(flag);
  expect(imported).toEqual(['./cronJobs', './lifecycleScheduler']);
  expect(schedule.mock.calls.map(call => call[0])).toEqual(['0 0 * * *', '0 0 * * *', '15 1 * * *']);
  expect(schedule.mock.calls.every(call => typeof call[1] === 'function')).toBe(true);
  // Captured callbacks are deliberately never invoked.
});

test('explicit false prevents every startup job import and registration', () => {
  const { schedule, log, imported } = load('false');
  expect(imported).toEqual([]);
  expect(schedule).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith('[cron] Core scheduling disabled (CRON_ENABLED=false)');
});
