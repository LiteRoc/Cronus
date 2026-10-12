import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {jest} from '@jest/globals';
const id=n=>n.toString(16).padStart(24,'0');
function load({size=4,failQuery=0,materialize,inspect}={}){
  const assets=Array.from({length:size},(_,i)=>({_id:id(i+1),facilityId:id(100)}));let calls=0;
  const find=jest.fn(filter=>{
    let rows=assets.filter(a=>!filter._id?.$gt||a._id>String(filter._id.$gt));
    if(filter._id?.$in)rows=rows.filter(a=>filter._id.$in.map(String).includes(a._id));
    return {sort(order){expect(order).toEqual({_id:1});return this;},limit(n){rows=rows.slice(0,n);return this;},
      lean(){calls++;return calls===failQuery?Promise.reject(Error('private database message')):Promise.resolve(rows);}};
  });
  const cache={materializePage:materialize??jest.fn(async page=>new Map(page.map(a=>[a._id,'refreshed']))),
    inspectPage:inspect??jest.fn(async page=>page.map(asset=>({asset,state:{state:'fresh'}})))};
  const module={exports:{}};
  vm.runInNewContext(readFileSync(new URL('../lifecycleCacheRefresh.js',import.meta.url),'utf8'),{
    require:name=>name==='mongoose'?{isValidObjectId:()=>true,isObjectIdOrHexString:()=>true,Types:{ObjectId:function(v){this.toString=()=>v;}}}:
      name==='../models/Asset'?{find,exists:async filter=>assets.some(a=>a._id>String(filter._id.$gt))}:cache,
    module,console
  });
  return {refresh:module.exports.refreshLifecycleCaches,find,cache};
}
test('bounded pages preserve progress and naturally revisit failed/conflicted/expired members on wrap',async()=>{
  const materialize=jest.fn(async page=>new Map(page.map(a=>[a._id,({[id(1)]:'failed',[id(2)]:'conflict',[id(3)]:'expired'})[a._id]??'refreshed'])));
  const h=load({materialize});const first=await h.refresh({pageSize:1,maxAssets:2,reportFailures:true});
  expect(first).toMatchObject({processed:2,failed:1,conflict:1,nextCursor:id(2),hasMore:true});
  expect(first.failures).toEqual([{assetId:id(1),outcome:'failed'},{assetId:id(2),outcome:'conflict'}]);
  const second=await h.refresh({pageSize:1,maxAssets:2,afterId:first.nextCursor});
  expect(second).toMatchObject({expired:1,refreshed:1,nextCursor:null,hasMore:false});
  await h.refresh({pageSize:1,maxAssets:2,afterId:second.nextCursor});
  expect(materialize.mock.calls[4][0][0]._id).toBe(id(1));
});
test('page failure does not strand later pages; missing outcomes become failures',async()=>{
  const materialize=jest.fn().mockRejectedValueOnce(Error('private')).mockResolvedValueOnce(new Map()).mockResolvedValue(new Map([[id(3),'refreshed']]));
  const h=load({size:3,materialize});const r=await h.refresh({pageSize:1,maxAssets:3,reportFailures:true});
  expect(r).toMatchObject({processed:3,failed:2,refreshed:1,nextCursor:null});expect(JSON.stringify(r)).not.toContain('private');
});
test('traversal query error preserves completed counts/cursor; subsequent invocation resumes',async()=>{
  const h=load({failQuery:2});const r=await h.refresh({pageSize:1,maxAssets:4,reportFailures:true});
  expect(r).toMatchObject({state:'incomplete',processed:1,refreshed:1,nextCursor:id(1),hasMore:null,reason:'bounded_refresh_query_failed'});
  const retry=await h.refresh({pageSize:1,maxAssets:4,afterId:r.nextCursor});expect(retry.processed).toBe(3);
});
test('first query error is incomplete with initial cursor retained, no fabricated outcomes',async()=>{
  const h=load({failQuery:1});expect(await h.refresh({pageSize:1,maxAssets:4})).toMatchObject({state:'incomplete',processed:0,nextCursor:null});
});
test('only complete beginning-to-end traversal produces bounded dependency-checked coverage',async()=>{
  const h=load({size:3});const r=await h.refresh({pageSize:2,maxAssets:4,reportCoverage:true});
  expect(r.coverage).toMatchObject({scope:'completed_traversal_members',consideredPopulation:3,eligibleObserved:3,fresh:3,isAtomicSnapshot:false});
  expect(h.cache.inspectPage.mock.calls.map(c=>c[0].length)).toEqual([2,1]);
  const partial=await h.refresh({pageSize:1,maxAssets:1,reportCoverage:true});expect(partial.coverage).toBeUndefined();
  const resumed=await h.refresh({pageSize:1,maxAssets:4,afterId:partial.nextCursor,reportCoverage:true});expect(resumed.coverage).toBeUndefined();
});
test('coverage error does not discard completed refresh outcomes',async()=>{
  const h=load({size:1,inspect:jest.fn().mockRejectedValue(Error('private'))});
  const r=await h.refresh({maxAssets:1,reportCoverage:true});expect(r.refreshed).toBe(1);
  expect(r.coverage).toEqual({scope:'unavailable',reason:'coverage_query_failed'});
});
test('shared service overlap is still guarded',async()=>{
  let release;const h=load({size:1,materialize:jest.fn(()=>new Promise(resolve=>{release=resolve;}))});
  const first=h.refresh({maxAssets:1});await Promise.resolve();await Promise.resolve();
  expect((await h.refresh({maxAssets:1})).state).toBe('overlap_skipped');
  release(new Map([[id(1),'refreshed']]));await first;expect((await h.refresh({maxAssets:1,afterId:id(1)})).state).toBe('completed');
});
test('1000 considered cap and 100 page bound hold with larger synthetic fleet',async()=>{
  const h=load({size:1010});const first=await h.refresh({pageSize:100,maxAssets:1000});
  expect(first).toMatchObject({processed:1000,nextCursor:id(1000),hasMore:true});
  expect(h.cache.materializePage.mock.calls).toHaveLength(10);
  expect(h.cache.materializePage.mock.calls.every(c=>c[0].length===100)).toBe(true);
  const second=await h.refresh({pageSize:100,maxAssets:1000,afterId:first.nextCursor});
  expect(second).toMatchObject({processed:10,nextCursor:null,hasMore:false});
});
test('fresh caches counted as skipped, not rewritten by traversal wrapper',async()=>{
  const materialize=jest.fn(async page=>new Map(page.map(a=>[a._id,'skipped'])));
  const h=load({size:3,materialize});expect(await h.refresh({maxAssets:3})).toMatchObject({processed:3,skipped:3,refreshed:0});
});
