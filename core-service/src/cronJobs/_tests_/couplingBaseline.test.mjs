import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {jest} from '@jest/globals';
test.each([['false',0],['true',3]])('frozen 9b95f68 coupling: global=%s schedules=%s', (flag,total)=>{
  const schedule=jest.fn(),imports=[];
  vm.runInNewContext(readFileSync(new URL('./fixtures/gitea25-baseline-index.cjs',import.meta.url),'utf8'),{
    process:{env:{CRON_ENABLED:flag}},console:{log(){}},require:name=>{
      imports.push(name);
      if(name==='./cronJobs'){schedule('0 0 * * *',()=>{});schedule('0 0 * * *',()=>{});}
      else vm.runInNewContext(readFileSync(new URL('./fixtures/gitea25-baseline-lifecycle.cjs',import.meta.url),'utf8'),{
        process:{env:{CRON_ENABLED:flag}},module:{exports:{}},console:{log(){}},require:dep=>dep==='node-cron'?{schedule}:{}
      });
    }
  });
  expect(schedule).toHaveBeenCalledTimes(total);
  expect(imports).toEqual(flag==='false'?[]:['./cronJobs','./lifecycleScheduler']);
});
