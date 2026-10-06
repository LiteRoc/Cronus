import { createRequire } from 'node:module';
const {buildAssetLifecycleAssessment:build,lifecycleCompatibilityMetrics:compat}=createRequire(import.meta.url)('../assetLifecycleAssessment.js');
const at=new Date('2026-01-01T00:00:00Z');
const policy=(extra={})=>({expectedLifeYears:5,sourceType:'asset_override',reference:'synthetic-policy',approvedBy:'000000000000000000000001',approvedAt:'2025-01-01',...extra});
const scope=(extra={})=>({knownSubtotal:100,total:100,isComplete:true,missingComponents:[],...extra});
const totals=(extra={})=>({lifetime:{total:10,scopes:{directMaintenance:scope()}},last12Months:{total:10,scopes:{directMaintenance:scope(extra)}}});
const run=(asset={},extra={})=>build({asset:{_id:'synthetic',...asset},asOf:at,...extra});
for(const [name,asset,type,proxy] of [
 ['explicit',{serviceStartDate:'2025-01-01',installationDate:'2000-01-01'},'service_start',false],
 ['installation',{installationDate:'2025-01-01',acquisitionDate:'2000-01-01'},'installation',false],
 ['acquisition',{acquisitionDate:'2025-01-01',purchaseDate:'2000-01-01'},'acquisition_proxy',true],
 ['structured purchase',{purchase:{date:'2025-01-01'},purchaseDate:'2000-01-01'},'purchase_proxy',true],
 ['legacy purchase',{purchaseDate:'2025-01-01'},'purchase_proxy',true],
])test(`${name} service resolution`,()=>{const r=run(asset).serviceAge;expect(r).toMatchObject({status:proxy?'estimated':'resolved',source:{type},isProxy:proxy,startDate:'2025-01-01T00:00:00.000Z'});expect(r.years).toBeCloseTo(365/365.25);});
test('missing date stays unknown despite known price/life',()=>expect(run({purchase:{price:100,expectedLifeYears:5}}).serviceAge).toEqual({years:null,startDate:null,status:'unknown',source:null,isProxy:false}));
test('manufacture date is not service age',()=>expect(run({manufactureDate:'2000-01-01'}).serviceAge.years).toBeNull());
for(const value of ['bad',0,Infinity])test(`invalid date ${value} cannot become zero/fallback`,()=>expect(run({serviceStartDate:value,installationDate:'2025-01-01'}).serviceAge).toMatchObject({years:null,status:'invalid'}));
test('future date is not started',()=>expect(run({serviceStartDate:'2027-01-01'}).serviceAge).toMatchObject({years:null,status:'not_started'}));
test('genuine zero age',()=>expect(run({serviceStartDate:at}).serviceAge).toMatchObject({years:0,status:'resolved'}));
test('unrounded age below threshold stays below',()=>expect(run({serviceStartDate:new Date(at-5*365.25*86400000+1000),lifecyclePolicy:policy()}).replacementAssessment.state).toBe('not_recommended'));
test('approved Asset overrides organization',()=>expect(run({lifecyclePolicy:policy()},{organizationPolicy:policy({expectedLifeYears:9,sourceType:'organization_policy'})}).expectedLife).toMatchObject({years:5,isAdopted:true,source:{type:'asset_override',adoptionStatus:'approved'}}));
test('organization resolves with provenance',()=>expect(run({}, {organizationPolicy:policy({sourceType:'organization_policy'})}).expectedLife).toMatchObject({years:5,isAdopted:true,source:{type:'organization_policy'}}));
test('organization precedes adopted benchmark',()=>expect(run({lifecyclePolicy:policy({sourceType:'adopted_benchmark'})},{organizationPolicy:policy({sourceType:'organization_policy',expectedLifeYears:7})}).expectedLife.years).toBe(7));
test('adopted benchmark resolves',()=>expect(run({lifecyclePolicy:policy({sourceType:'adopted_benchmark'})}).expectedLife).toMatchObject({years:5,isAdopted:true,source:{type:'adopted_benchmark'}}));
for(const [name,asset,template,type] of [
 ['purchase',{purchase:{expectedLifeYears:6}},null,'legacy_asset'],
 ['default',{}, {lifecycleDefaults:{expectedLifeYears:6}},'legacy_template_default'],
 ['legacy',{}, {eolYears:6},'legacy_template'],
])test(`${name} remains provisional`,()=>expect(run(asset,{template}).expectedLife).toMatchObject({years:6,status:'provisional',isAdopted:false,source:{type,adoptionStatus:'provisional'}}));
test('reference benchmark is not policy',()=>expect(run({}, {template:{benchmark:{source:'Synthetic OEM',expectedUsefulLifeYears:5}}}).expectedLife).toMatchObject({years:null,referenceYears:5,status:'reference_only',isAdopted:false}));
for(const value of [0,-1,Infinity,'5'])test(`invalid expected life ${value}`,()=>expect(run({purchase:{expectedLifeYears:value}}).expectedLife).toMatchObject({years:null,status:'invalid'}));
test('unknown expected life',()=>expect(run().expectedLife).toMatchObject({years:null,status:'unknown'}));
test('unapproved policy cannot adopt',()=>expect(run({lifecyclePolicy:{expectedLifeYears:5,reference:'claim'}}).replacementAssessment.state).toBe('insufficient_data'));
test('future approval unavailable as-of',()=>expect(run({lifecyclePolicy:policy({approvedAt:'2027-01-01'})}).expectedLife.isAdopted).toBe(false));
test('benchmark adopted for another Template does not apply',()=>expect(run({templateId:'a',lifecyclePolicy:policy({templateId:'b',sourceType:'adopted_benchmark'})}).expectedLife.isAdopted).toBe(false));
test('ambiguous organization policy unavailable',()=>expect(run({}, {organizationPolicy:{ambiguous:true}}).expectedLife).toMatchObject({years:null,status:'invalid'}));
test('disabled policy explicit',()=>expect(run({lifecyclePolicy:policy({ageRuleEnabled:false,expectedLifeYears:null})}).expectedLife).toMatchObject({years:null,status:'disabled'}));
test('structured acquisition/currency precedes legacy',()=>expect(run({purchase:{price:100,currency:'USD'},purchaseCost:200}).capital.acquisitionBasis).toMatchObject({amount:100,currency:'USD',source:{type:'asset_purchase'}}));
test('legacy acquisition does not invent currency',()=>expect(run({purchaseCost:100}).capital.acquisitionBasis).toMatchObject({amount:100,currency:null,source:{type:'legacy_purchase_cost'}}));
test('recorded zero acquisition preserved',()=>expect(run({purchase:{price:0},purchaseCost:100}).capital.acquisitionBasis.amount).toBe(0));
test('benchmark cannot supply acquisition/depreciation',()=>{const r=run({serviceStartDate:'2020-01-01',lifecyclePolicy:policy()},{template:{benchmark:{averageQuotedPrice:100000}}});expect(r.capital.acquisitionBasis.amount).toBeNull();expect(r.capital.estimatedDepreciatedValue.amount).toBeNull();expect(r.capital.replacementValue.amount).toBe(100000);});
test('purchase is not replacement fallback',()=>expect(run({purchase:{price:100}}).capital.replacementValue.amount).toBeNull());
test('quote provenance does not fabricate unavailable evidence',()=>expect(run({}, {template:{benchmark:{averageQuotedPrice:100000,averageListPrice:200000,confidence:'high'}}}).capital.replacementValue).toMatchObject({amount:100000,currency:null,status:'estimated',source:{type:'template_average_quoted_price',sourceDate:null,validThrough:null,confidence:'high'}}));
test('list fallback separate',()=>expect(run({}, {template:{benchmark:{averageListPrice:1000}}}).capital.replacementValue.source.type).toBe('template_average_list_price'));
test('future quote evidence invalid',()=>expect(run({}, {template:{benchmark:{averageQuotedPrice:1000,reportDate:'2027-01-01'}}}).capital.replacementValue).toMatchObject({amount:null,status:'invalid'}));
test('invalid acquisition is not zero',()=>expect(run({purchase:{price:'bad'}}).capital.acquisitionBasis).toMatchObject({amount:null,status:'invalid'}));
test('unknown salvage zero is an assumption',()=>{const r=run();expect(r.capital.salvage).toMatchObject({recordedAmount:null,planningAmount:0,basis:'assumption'});expect(r.quality.assumptions).toContain('zero_planning_salvage');});
test('legacy default zero remains ambiguous raw zero',()=>expect(run({purchase:{salvageValue:0}}).capital.salvage).toMatchObject({rawAmount:0,recordedAmount:null,planningAmount:0,basis:'assumption'}));
test('documented zero salvage',()=>expect(run({purchase:{salvageValue:0,salvageEvidenceRef:'synthetic'}}).capital.salvage).toMatchObject({recordedAmount:0,planningAmount:0,basis:'recorded'}));
test('assumption can be disallowed',()=>expect(run({}, {allowZeroSalvageAssumption:false}).capital.salvage).toMatchObject({planningAmount:null,basis:'unknown'}));
test('complete estimated depreciation',()=>expect(run({serviceStartDate:'2025-01-01',purchase:{price:100000,currency:'USD'},lifecyclePolicy:policy()}).capital.estimatedDepreciatedValue).toMatchObject({amount:80013.69,annualDepreciation:20000,status:'estimated',currency:'USD'}));
test('incomplete depreciation enumerates inputs',()=>expect(run().capital.estimatedDepreciatedValue).toMatchObject({amount:null,status:'insufficient_data',missingInputs:['acquisition_basis','service_start','expected_life']}));
test('salvage cannot exceed basis',()=>expect(run({serviceStartDate:'2025-01-01',purchase:{price:100,salvageValue:101},lifecyclePolicy:policy()}).capital.estimatedDepreciatedValue).toMatchObject({amount:null,missingInputs:['valid_salvage']}));
test('accounting book value unavailable',()=>expect(run({serviceStartDate:'2020-01-01',purchase:{price:100},lifecyclePolicy:policy()}).capital.accountingBookValue).toMatchObject({amount:null,status:'not_available'}));
for(const [name,asset,state,code] of [
 ['reached',{serviceStartDate:'2020-01-01',lifecyclePolicy:policy()},'recommended','expected_life_reached'],
 ['below',{serviceStartDate:'2025-01-01',lifecyclePolicy:policy()},'not_recommended','expected_life_not_reached'],
 ['missing age',{lifecyclePolicy:policy()},'insufficient_data','service_age_unknown'],
 ['invalid age',{serviceStartDate:'bad',lifecyclePolicy:policy()},'insufficient_data','invalid_service_date'],
 ['future age',{serviceStartDate:'2027-01-01',lifecyclePolicy:policy()},'insufficient_data','service_not_started'],
 ['missing life',{serviceStartDate:'2025-01-01'},'insufficient_data','expected_life_unknown'],
 ['no adopted rule',{serviceStartDate:'2000-01-01',purchase:{expectedLifeYears:5}},'insufficient_data','policy_not_configured'],
 ['disabled',{lifecyclePolicy:policy({ageRuleEnabled:false})},'insufficient_data','age_policy_disabled'],
])test(`${name} tri-state`,()=>{const r=run(asset).replacementAssessment;expect(r).toMatchObject({state,meaning:'replacement_review',reasonCodes:[code]});expect(r.rules[0].reasonCode).toBe(code);expect(r.displayText).toBeTruthy();});
test('low-book-maintenance rule retired',()=>{const r=run({serviceStartDate:'2025-01-01',purchase:{price:100},lifecyclePolicy:policy({expectedLifeYears:100})},{maintenanceTotals:totals()});expect(r.capital.estimatedDepreciatedValue.amount).toBeLessThan(150);expect(r.replacementAssessment.state).toBe('not_recommended');expect(r.replacementAssessment.rules).toHaveLength(1);});
for(const incomplete of [false,true])test(`${incomplete?'incomplete':'complete'} scope and window preserved`,()=>{const t=totals(incomplete?{total:null,isComplete:false,missingComponents:[{component:'internalTravel',reason:'unapproved'}]}:{});const before=JSON.stringify(t);const r=run({}, {maintenanceTotals:t});expect(r.maintenance.last365Days.directMaintenance).toEqual(t.last12Months.scopes.directMaintenance);expect(r.maintenance.window).toMatchObject({start:'2025-01-01T00:00:00.000Z',end:'2026-01-01T00:00:00.000Z',dateField:'completionDate',statuses:['Completed']});expect(JSON.stringify(t)).toBe(before);});
test('deterministic assessment',()=>expect(run()).toEqual(run()));
test('invalid evaluation rejected',()=>expect(()=>run({}, {asOf:'bad'})).toThrow('Valid lifecycle'));
test('unsupported policy rejected',()=>expect(()=>run({}, {policyVersion:'future'})).toThrow('Unsupported'));
test('compatibility aliases nullable and scope-preserving',()=>expect(compat(run(),totals())).toMatchObject({currentBookValue:null,yearsInService:null,replacementRecommended:null,replacementAssessmentState:'insufficient_data',projectedAnnualMaintenance:10}));
for(const value of ['2025-02-30','01/01/2025','0'])test(`invalid/noncanonical calendar date ${value}`,()=>expect(run({serviceStartDate:value}).serviceAge.status).toBe('invalid'));
test('ambiguous organization policy cannot be bypassed by benchmark adoption',()=>expect(run({lifecyclePolicy:policy({sourceType:'adopted_benchmark'})},{organizationPolicy:{ambiguous:true}}).replacementAssessment.state).toBe('insufficient_data'));
test('approval source type must match evidence scope',()=>expect(run({lifecyclePolicy:policy({sourceType:'organization_policy'})}).expectedLife.isAdopted).toBe(false));
test('nonfinite depreciation is unavailable',()=>expect(run({serviceStartDate:'2025-01-01',purchase:{price:1e12},lifecyclePolicy:policy({expectedLifeYears:1e-300})}).capital.estimatedDepreciatedValue.amount).toBeNull());
