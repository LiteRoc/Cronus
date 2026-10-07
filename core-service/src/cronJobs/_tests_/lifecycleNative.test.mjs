import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('scheduler dependency graph executes natively without Babel, cron or real database',()=>{const file=fileURLToPath(new URL('./lifecycleNativeProbe.cjs',import.meta.url));const output=execFileSync(process.execPath,[file],{encoding:'utf8',timeout:15000,env:{...process.env,CRON_ENABLED:'false'}});expect(JSON.parse(output)).toEqual({nativeModuleExecution:'passed',refreshed:1,scheduling:'forbidden',persistence:'mocked'});});
