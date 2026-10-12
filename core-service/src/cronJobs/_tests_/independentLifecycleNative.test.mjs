import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('native tick/canonical writer proof has no cron timer or database; resumes, wraps and skips overlap',()=>{
  const output=execFileSync(process.execPath,[fileURLToPath(new URL('./independentLifecycleProbe.cjs',import.meta.url))],{
    encoding:'utf8',timeout:20000,env:{...process.env,CRON_ENABLED:'false',LIFECYCLE_CACHE_CRON_ENABLED:'false'}
  });
  const lines=output.trim().split('\n');
  expect(lines[0]).toBe('[cron] Core scheduling disabled (CRON_ENABLED=false)');
  expect(JSON.parse(lines.at(-1))).toEqual({nativeScheduler:'passed',registration:'captured',persistence:'mocked',
    firstConsidered:1000,secondConsidered:1,thirdSkippedFresh:1000,overlap:'skipped',sourceWrites:0});
});
