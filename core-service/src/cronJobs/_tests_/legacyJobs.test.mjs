import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {jest} from '@jest/globals';
function load({orders=[],assets=[]}={}){
  const callbacks=[],sendEmail=jest.fn(),sendSMS=jest.fn(),save=jest.fn();
  const workOrderFind=jest.fn(()=>({populate:async()=>orders}));
  const assetFind=jest.fn(()=>({populate:async()=>assets}));
  const WorkOrder=function(data){Object.assign(this,data);this.save=save;};WorkOrder.find=workOrderFind;
  const module={exports:{}};
  vm.runInNewContext(readFileSync(new URL('../cronJobs.js',import.meta.url),'utf8'),{
    require:name=>name==='node-cron'?{schedule:(expression,callback)=>{callbacks.push({expression,callback});}}:
      name==='../models/WorkOrder'?WorkOrder:name==='../models/Asset'?{find:assetFind}:
      name==='../services/notificationService'?{sendEmail,sendSMS}:{},
    module,console:{log(){},error:jest.fn()}
  });
  return {callbacks,sendEmail,sendSMS,save,workOrderFind,assetFind,module};
}
test('legacy registration retains exactly two midnight callbacks without immediate effects',()=>{
  const h=load();expect(h.callbacks.map(c=>c.expression)).toEqual(['0 0 * * *','0 0 * * *']);
  expect(h.workOrderFind).not.toHaveBeenCalled();expect(h.assetFind).not.toHaveBeenCalled();expect(h.save).not.toHaveBeenCalled();
});
test('overdue callback retains notification behavior with external calls mocked',async()=>{
  const h=load({orders:[{_id:'synthetic',assignedTo:{email:'synthetic@example.invalid',phoneNumber:'synthetic'}}]});
  await h.callbacks[0].callback();expect(h.sendEmail).toHaveBeenCalledTimes(1);expect(h.sendSMS).toHaveBeenCalledTimes(1);
  expect(h.save).not.toHaveBeenCalled();expect(h.assetFind).not.toHaveBeenCalled();
});
test('maintenance callback retains existing WorkOrder generation with persistence mocked',async()=>{
  const h=load({assets:[{_id:'synthetic',ctrlNumber:'synthetic',maintenanceSchedule:{procedure:{_id:'synthetic-procedure'}}}]});
  await h.callbacks[1].callback();expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.sendEmail).not.toHaveBeenCalled();expect(h.sendSMS).not.toHaveBeenCalled();
});
