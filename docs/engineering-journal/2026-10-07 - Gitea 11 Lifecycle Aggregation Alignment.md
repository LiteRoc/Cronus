# Gitea #11 — Lifecycle Aggregation Alignment

Date: 2026-10-07. Status: implemented and branch-verified; delivery commits,
fresh merged-main gates and closure are recorded in [Gitea #11](http://192.168.1.185:3000/LiteRoc/cronus/issues/11).
Deployment not performed and not authorized by software closure.

## Context and frozen evidence

Baseline main `cf862e5218172ba274799b4287d20dea38198f74` includes #20's canonical
Asset assessment and #21's current Contract coverage boundary. Branch:
`feat/gitea-11-lifecycle-aggregation`.
The clean paused CRM checkout remained at `807bc38122e771dacccbc23fca4a66363dd58d55`;
implementation used the existing isolated task worktree, not the CRM/runtime worktrees.

`core-service/evidence/gitea-11/` contains frozen baseline source excerpts, a purely
synthetic VM reproduction, observed JSON and SHA256SUMS. Run
`node core-service/evidence/gitea-11/reproduction.cjs`; compare stdout with observed.json.
No database/provider is involved. It reproduces:

- Known replacement 100,000 plus unknown shown as numeric fleet total 100,000;
  missing planning/book values summed as zero.
- Canonical insufficient-data review collapsed into boolean recommendation counts.
- Missing Contract hydration reduces hydrated count without making the capital total incomplete.
- Template summary includes Pending and a deleted Asset; benchmark includes Pending
  and an archived Asset instead. Their counts happen to match but cohorts differ.
- A supposedly global operational benchmark includes another Facility.
- Narrow observed labor/parts maintenance 10 differs from direct-maintenance subtotal
  60 with incomplete travel.
- Empty Template/Contract recommendation percentages equal zero.

## Implemented boundaries

`lifecycleAggregation.js` is a pure, core-owned lifecycle aggregation boundary. It
consumes `asset-lifecycle-v2` facts, validates versions/member identity/evaluation instant,
and never resolves dates, expected-life evidence, prices or replacement rules itself.
`assetLifecycleAssessmentBatch.js` factors the existing #20 orchestration: Facility
organization policies, canonical LifecycleMaintenance and the unchanged #20 builder.
Asset detail and fleet reads share this boundary. Dependency/per-Asset failures become
explicit unavailable assessments; stored metrics are not used as fallback authority.

The Facility-authorized read-only `POST /assets/lifecycle/batch` accepts IDs and an
optional evaluation `asOf`, validates input, deduplicates, and assesses sequential
200-ID chunks. Maximum request population is 2,000 IDs; larger requests fail rather
than truncate. Every requested member remains in the response, including inaccessible,
missing, archived/deleted and failed-assessment placeholders. Non-sensitive reasons
avoid cross-Facility hydration/disclosure. Authentication and selected-Facility
validation use existing ownership controls; forwarded credentials remain per request.
No assessment/cache persistence occurs. Evaluation time is not historical source-fact
or Contract-coverage reconstruction.

Template `cohortFilter` aligns operational summary and local benchmark to selected
Facility, Template ID, Active + Inactive, deletedAt null and not archived. Pending uses
the same authorization/exclusion predicates but is counted separately. Retired and
other excluded cohorts cannot enter current fleet statistics. Global operational
benchmark is null/not_authorized; Template reference evidence remains separate and
is not adopted policy merely because it exists.

Contract reads #21's `resolveCurrentContractCoverage` only and delegates its exact
current member IDs to core. It validates batch identity, Facility, versions/shape and
population reconciliation. Vendor-only references cannot enter hydration, capital or
recommendation denominators. Individual unavailable members preserve population;
whole upstream failure returns 503 with the known current population, no fabricated
financial totals. No raw purchase/benchmark repricing and no stored book-value fallback.
Current coverage/anomaly metadata remains available; no responsibility records change.

## Aggregate semantics

Schema `lifecycle-aggregate-v1` exposes population, age, replacement review, capital,
maintenance, versions and evaluation metadata.

Each capital measure (replacement, estimated depreciation, accounting book) independently
reports knownSubtotal, nullable complete total, isComplete, valued/missing/unresolved
counts and reasons. Explicit resolved numeric zero is valued. Unknown/invalid/missing
assessment is not a priced zero. Unknown amounts can produce a knownSubtotal of zero
with total null; this is disclosed as an empty known subtotal, never a fleet zero.
Known compatible currency values form sorted currencyGroups; mixed groups have no
single subtotal/total. Currency-unknown amounts remain individually visible and are
not added together or to known-currency groups. A single unknown-currency amount may
be individually shown as knownSubtotal but its total remains null. No FX, invented
USD evidence or historical price fallback. #20 replacement benchmarks currently lack
currency evidence; their numeric amount alone cannot establish complete capital.
Empty population has a vacuous zero monetary total; mean/percentage denominators are null.

Replacement review counts recommended, not_recommended, insufficient_data and unavailable
assessment separately. Evaluated count includes only the first two. Percent-of-population
and percent-of-evaluated names declare denominators; zero denominator gives null.
No new rule/threshold is introduced. Age consumes serviceAge, preserving resolved,
estimated/proxy, unknown, invalid, not_started and unavailable states. Numeric half-open
buckets [0,3), [3,6), [6,9), [9,infinity) have no fractional gaps; unknown states never
become a young age bucket.

Primary maintenance is **Direct Maintenance Cost — Last 365 Days** and uses canonical
#7 directMaintenance scope. Missing components, valuation bases, known WorkOrder counts
and completeness are preserved. Fleet total/mean require whole-population completeness;
complete-record sample mean/median disclose both sample and population size. USD is
identified by existing wo-cost-v1 economics, not inferred for capital. Window metadata
retains the existing inclusive start/end, rolling 365 elapsed days, Completed status
and completionDate predicate. This differs intentionally from Contract profitability's
cost-to-serve populations/windows; no attempt is made to force equal figures.

## API/UI compatibility and rollout

Canonical structured fields are authoritative. Deprecated aliases explicitly retain
observed internal labor + parts scope (projectedAnnualMaintenance is not a projection).
Template narrow average is a nullable complete fleet mean; tenant benchmark narrow
statistics remain explicitly complete-record samples. Replacement/book scalar aliases
now return complete totals only, null if incomplete; currentBookValue remains a deprecated
planning estimate alias, never accounting book value. Recommendation percentage aliases
state population denominator and are null when empty.

Old Template ageBuckets keys and lifecycleDefaults in the operational response are
explicitly removed/deprecated rather than reusing changed boundaries or implying raw
benchmark life is adopted policy. Global operational benchmark returns null. Types and
both lifecycle cards move together to the versioned canonical shape; legacy payloads
render unavailable instead of fabricating canonical facts. This requires coordinated
API/UI deployment, separately authorized. No deployment occurs here.

Shared frontend lifecycle details show cohort/assessment counts, all review states,
age states, partial/unknown-currency capital, observed direct-maintenance subtotal,
missing economics and explicit sample/window information. Member drilldowns use the
exact response population, with authorized Asset detail links and unavailable placeholders,
rather than unsupported Contract URL filters or stale replacement-cache filters.
Deprecated Template filter links remain marked legacy_cache_until_gitea_8; the cards do
not rely on them. Original Contract totalValue is accurately labeled original base annual
value, without changing the financial timeline or profitability services.

No persisted schema change, real-data migration or backfill. Rollback is a software
rollback of the coordinated service/frontend release; no data reversal is required.
Package/lockfiles and dependencies are unchanged. Cache writes and historical economics
are not introduced.

## Verification

Baseline: core 1,516 / 21 suites; Contract 199 / 13; frontend 292 / 36, all passing.
Final branch gates: core **1,554 / 22 suites**, Contract **205 / 13**, frontend
**305 / 37**, all passing. New tests cover canonical helper semantics, independent
capital completeness, cohorts, fractional age, currencies, unavailable assessments,
bounded/deduplicated batch inputs, authorization/isolation, read purity, tri-state
review, direct-maintenance completeness/samples/window and UI member/currency behavior.
Existing #21 extra/duplicate upstream test now asserts fail-closed canonical batch
rejection; frozen evidence preserves the pre-change response. Existing Facility
assertions retain selection/security and now expect unadopted legacy life to be
insufficient_data under #20, not an old heuristic recommendation.

TypeScript app/node projects pass with the existing ignoreDeprecations 5.0 override
(installed compiler 5.6 versus checked-in 6.0 setting; dependencies/config unchanged).
Vite builds to an isolated /tmp output; existing large-chunk warning remains. Changed
JS syntax, git diff --check, frozen checksums/stdout comparison and exact baseline
package/lockfile comparison pass. Mongo tests use issued ephemeral loopback URIs and
fail-closed harnesses; providers and cron are disabled/mocked. No configured real Mongo.
Fresh merged-main verification and delivery SHAs are recorded in the final issue comment.

### Exact suite counts


Core:

| Suite | Passed |
| --- | ---: |
| `src/routers/_tests_/operationalOwnership.test.mjs` | 214 |
| `src/routers/_tests_/templateLifecycle.test.mjs` | 155 |
| `src/routers/_tests_/workOrderSubresourceSecurity.test.mjs` | 339 |
| `src/routers/_tests_/testEquipmentPickerSecurity.test.mjs` | 49 |
| `src/routers/_tests_/workOrderCosts.test.mjs` | 84 |
| `src/routers/_tests_/procedureMeasurements.test.mjs` | 78 |
| `src/routers/_tests_/referenceLifecycle.test.mjs` | 103 |
| `src/routers/_tests_/referenceLifecycleStandalone.test.mjs` | 31 |
| `src/routers/_tests_/followUp.endpoint.test.mjs` | 87 |
| `src/routers/_tests_/facilityQueryIsolation.test.mjs` | 29 |
| `src/routers/_tests_/assetLifecycleAssessment.endpoint.test.mjs` | 47 |
| `src/routers/_tests_/vendorSecurity.test.mjs` | 90 |
| `src/routers/_tests_/facilityIsolationCompatibility.test.mjs` | 16 |
| `src/routers/_tests_/contact.endpoint.test.mjs` | 49 |
| `src/routers/_tests_/supplierSecurity.test.mjs` | 59 |
| `src/routers/_tests_/ticketPromotionStandalone.test.mjs` | 1 |
| `src/services/_tests_/followUp.service.test.mjs` | 20 |
| `src/services/_tests_/contact.service.test.mjs` | 7 |
| `src/services/_tests_/assetLifecycleAssessment.test.mjs` | 69 |
| `src/services/_tests_/lifecycleAggregation.test.mjs` | 21 |
| `src/utils/_tests_/lifecycle.util.test.mjs` | 3 |
| `src/cronJobs/_tests_/schedulerRegistration.test.mjs` | 3 |

Contract:

| Suite | Passed |
| --- | ---: |
| `src/routes/_tests_/vendorCoverage.endpoint.test.js` | 62 |
| `src/security/_tests_/coreAuthentication.security.test.js` | 31 |
| `src/routes/_tests_/amendmentLifecycle.endpoint.test.js` | 13 |
| `src/security/_tests_/vendorHistory.security.test.js` | 6 |
| `src/security/_tests_/contractAuthentication.security.test.js` | 23 |
| `src/jobs/_tests_/contractLifecycleJob.test.js` | 11 |
| `src/routes/_tests_/contractValue.endpoint.test.js` | 3 |
| `src/controllers/_tests_/costProfitability.test.js` | 3 |
| `src/services/_tests_/contractOverview.service.test.js` | 4 |
| `config/_tests_/dbLogging.test.js` | 3 |
| `src/services/_tests_/currentContractCoverage.test.js` | 27 |
| `src/services/_tests_/contractValue.service.test.js` | 16 |
| `src/services/_tests_/workOrderCostAdapter.test.js` | 3 |

Frontend:

| Suite | Passed |
| --- | ---: |
| `src/services/assetLifecycle.test.ts` | 3 |
| `src/services/assetOwnership.test.ts` | 5 |
| `src/services/contactAPI.test.ts` | 5 |
| `src/services/contractVendorCoverage.test.ts` | 3 |
| `src/services/followUpAPI.test.ts` | 8 |
| `src/services/ownershipCreateAPI.test.ts` | 4 |
| `src/services/procedureMeasurements.test.ts` | 1 |
| `src/services/templateLifecycle.test.ts` | 48 |
| `src/services/testEquipmentPickerAPI.test.ts` | 5 |
| `src/services/vendorAPI.test.ts` | 5 |
| `src/services/workOrderEquipmentAPI.test.ts` | 6 |
| `src/services/workOrderLaborAPI.test.tsx` | 8 |
| `src/components/lifecycle/LifecycleAggregateDetails.test.tsx` | 13 |
| `src/pages/AddAsset/ownershipCompatibility.test.tsx` | 7 |
| `src/pages/Contacts/ContactAccess.test.tsx` | 7 |
| `src/pages/Contacts/ContactFollowUps.test.tsx` | 6 |
| `src/pages/Contacts/ContactsPage.test.tsx` | 31 |
| `src/pages/EditTemplates/templateLifecycle.test.tsx` | 13 |
| `src/pages/FollowUps/FollowUpAccess.test.tsx` | 7 |
| `src/pages/FollowUps/FollowUpsPage.test.tsx` | 45 |
| `src/pages/FollowUps/dateTime.test.ts` | 5 |
| `src/pages/Contracts/Contracts/ContractDetailPage.coverage.test.tsx` | 4 |
| `src/pages/Contracts/components/VendorResponsibilityPicker.test.tsx` | 6 |
| `src/pages/EditAsset/components/AssetFormFields.lifecycle.test.tsx` | 3 |
| `src/pages/EditAsset/components/AssetLifecycleCard.test.tsx` | 17 |
| `src/pages/EditWorkOrder/components/WorkOrderCostSummary.test.tsx` | 2 |
| `src/pages/EditWorkOrder/hooks/useTestEquipment.test.tsx` | 5 |
| `src/pages/EditWorkOrder/modals/AddTestEquipmentModal.test.tsx` | 1 |
| `src/pages/EditWorkOrder/modals/procedureMeasurements.test.tsx` | 32 |

## Explicitly deferred / operational safety

#8 remains open/unstarted: persisted Asset.metrics freshness, list/filter/cache/dashboard
redesign, invalidation, scheduler defect/hardening/enablement and fleet refresh. No #8
work is included. No scheduler module changed or ran.
Historical/as-of Contract coverage, future/backdated amendment effective dates and any
new maintenance-based replacement threshold remain unresolved. #19 remains open/BLOCKED;
no labor rate is approved or published. CRM remains paused and unchanged.
No real Mongo/business data, vendor anomalies, Contract membership, Asset metrics,
containers/runtime, deployment or bulk repair were changed. #7 snapshots/calculation
and #20 policy rules remain unchanged. Stop after #11 software closure.
