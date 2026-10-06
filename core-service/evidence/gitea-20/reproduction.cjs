// Frozen synthetic #20 reproduction against main e8ccfe1; no DB/startup imports.
const assert = require('node:assert/strict');
const { computeLifecycleMetrics } = require('./legacy-lifecycle.cjs');
const now = new Date('2026-01-01T00:00:00Z');
const rows = [];
function check(name, asset, template, expected, maintenance = 0) {
  const actual = computeLifecycleMetrics({asset, template, now, last12MonthMaintenanceTotal: maintenance});
  const observed = Object.fromEntries(Object.keys(expected).map(key => [key, actual[key]]));
  assert.deepEqual(observed, expected); rows.push({name, observed});
}
check('missing start is zero and young', {purchase:{price:100000,expectedLifeYears:5}}, null, {yearsInService:0,currentBookValue:100000});
check('future start becomes zero', {purchase:{date:'2027-01-01',price:100000,expectedLifeYears:5}}, null, {yearsInService:0});
check('invalid start becomes zero', {purchase:{date:'invalid',price:100000,expectedLifeYears:5}}, null, {yearsInService:0});
check('replacement benchmark becomes depreciation basis', {installationDate:'2025-01-01'}, {benchmark:{averageQuotedPrice:100000,expectedUsefulLifeYears:5}}, {currentBookValue:80013.69,annualDepreciation:20000});
check('missing acquisition basis becomes zero', {}, null, {currentBookValue:0,annualDepreciation:0});
check('missing evidence becomes negative boolean', {}, null, {replacementRecommended:false,replacementReason:null});
check('low book versus maintenance triggers default recommendation', {purchase:{price:100,date:'2025-01-01',expectedLifeYears:100}}, null, {replacementRecommended:true,replacementReason:'Book value low vs maintenance trend'}, 100);
assert.equal(rows[0].observed.yearsInService <= 2, true);
console.log(JSON.stringify({baseline:'e8ccfe1831016a781dabd08ec696e6cc25a0b5a3',passed:rows.length,rows},null,2));
