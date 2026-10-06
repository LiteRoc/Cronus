import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
const A='000000000000000000000001', B='000000000000000000000002', F='000000000000000000000003', V='000000000000000000000004';
const rows=[];
let contract;
const context=vm.createContext({mongoose,console,buildTenantFilter:()=>({facilityId:F}),isValidId:id=>mongoose.Types.ObjectId.isValid(String(id)),Contract:{findOne:()=>({lean:async()=>contract,then:resolve=>resolve(contract)})},fetchVendorSnapshot:async()=>({vendorId:V,nameSnapshot:'Synthetic Vendor'}),computeAmendmentImpact:()=>({nextContract:{coveredAssets:[]}}),transitionAmendment:(doc,idx)=>{doc.amendments[idx].status='applied';}});
for(const name of ['addVendorLink','updateVendorLinkAssets','getContractLifecycleIntelligence','applyApprovedAmendmentToContract']){
 const source=fs.readFileSync(new URL(name+'.txt',import.meta.url),'utf8').replace('export ','');
 vm.runInContext(source+`\nglobalThis.${name}=${name};`,context);
}
function fresh(){contract={_id:V,type:'customer',coveredAssets:[A],vendorLinks:[],amendments:[{amendmentNumber:'synthetic.1',status:'approved'}],save:async()=>{},toObject(){return this;}};contract.vendorLinks.id=()=>contract.vendorLinks[0];}
async function call(name,body){const res={status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await context[name]({params:{id:V,linkId:V},body,core:{post:async(_path,{assetIds})=>({data:{assets:assetIds.map(_id=>({_id,purchase:{price:1},metrics:{}}))}}),get:async()=>({data:{metrics:{replacementRecommended:true,currentBookValue:1,projectedAnnualMaintenance:0,maintenanceScopes:{last12Months:{directMaintenance:{knownSubtotal:0,isComplete:true}}}}}})},headers:{},user:{role:'admin'}},res);return res;}
for(const [name,ids] of [['out_of_coverage',[B]],['missing_asset',[B]],['cross_facility_asset',[B]],['invalid_id',['invalid']],['duplicate_ids',[A,A]]]){fresh();const r=await call('addVendorLink',{vendorId:V,coveredAssetIds:ids});assert.equal(r.code,201);rows.push({name,status:r.code,stored:contract.vendorLinks[0].coveredAssetIds});}
fresh();contract.vendorLinks.push({_id:V,coveredAssetIds:[A]});await call('updateVendorLinkAssets',{add:[B]});assert.deepEqual(Array.from(contract.vendorLinks[0].coveredAssetIds),[A,B]);rows.push({name:'update_out_of_coverage',stored:contract.vendorLinks[0].coveredAssetIds});
fresh();contract.vendorLinks.push({coveredAssetIds:[A,B]});const r=await call('getContractLifecycleIntelligence',{});assert.equal(r.body.summary.coveredAssetCount,2);rows.push({name:'vendor_expands_lifecycle',coveredAssetCount:r.body.summary.coveredAssetCount});
fresh();contract.vendorLinks.push({coveredAssetIds:[A],coverageType:'parts-only'},{coveredAssetIds:[A],coverageType:'labor-only'});await context.applyApprovedAmendmentToContract(contract,0,A);assert.equal(contract.coveredAssets.length,0);assert.equal(contract.vendorLinks[0].coveredAssetIds.length,1);rows.push({name:'applied_remove_leaves_responsibility',coverage:contract.coveredAssets,responsibility:contract.vendorLinks.map(l=>l.coveredAssetIds)});
console.log(JSON.stringify({baseline:'5e9fdfdef16f4b0afac87d31ef70612fc39f2646',assertions:8,rows},null,2));
