# Gitea #20 — Canonical Asset Lifecycle Assessment

## Status and scope

Asset-level software implementation and branch verification complete; deployment not
performed. Controlled merge, fresh merged-main verification, pushed SHAs and issue
closure are recorded separately in the final verification comment on
[#20](http://192.168.1.185:3000/LiteRoc/cronus/issues/20). This journal does not claim
unperformed production verification or completion of dependent issues.

Baseline: `main @ e8ccfe1831016a781dabd08ec696e6cc25a0b5a3`; fresh Gitea/GitHub fetches
matched it. Existing main worktree and CRM checkout were clean. Task branch:
`feat/gitea-20-canonical-asset-lifecycle`, created from main in the existing non-runtime
worktree `/tmp/cronus-facility-query-isolation`. CRM remains untouched at
`807bc38122e771dacccbc23fca4a66363dd58d55`. #17/#18 were verified closed;
#19 open/BLOCKED; #21/#11/#8 open and not assigned implementation.

Policy authority: [Lifecycle Policy Decisions Approved](<2026-10-06 - Lifecycle Policy Decisions Approved.md>).
No new maintenance threshold or Contract historical-coverage policy is selected.

## Frozen before evidence

`core-service/evidence/gitea-20/` preserves the baseline calculator byte-for-byte,
synthetic reproduction, observed results and SHA256SUMS. Seven assertions reproduce:
missing start becoming zero/young; future/invalid dates becoming zero; quoted-price
benchmark becoming depreciation basis; missing acquisition becoming zero; missing
evidence becoming false; and low book value versus maintenance triggering replacement.
Re-running the frozen reproduction matches the observed JSON checksum. No copyrighted
benchmark data, operational records, startup imports or database connections are used.

Baseline suites passed core 1,414, Contract 116 and frontend 256. Initial backend runs
were denied local test sockets by the sandbox; reruns used the approved execution
boundary and inspected fail-closed synthetic MongoMemoryServer harnesses. Configured
and arbitrary Mongo targets are refused, binary downloads disabled, cached binary
explicit, providers mocked and cron disabled/controlled. No real Mongo was accessed.

## Canonical implementation and provenance

`core-service/src/services/assetLifecycleAssessment.js` owns the pure
`buildAssetLifecycleAssessment` boundary. Inputs are Asset, Template, already scoped
organization policy evidence, canonical maintenance facts, evaluation/computation dates
and supported policy version. Explicit inputs yield deterministic output. Versions:
`asset-lifecycle-v2`, calculation `asset-lifecycle-v2.0`, policy
`approved-lifecycle-2026-10-06`, economics `wo-cost-v1`.

Service date precedence: explicit confirmed serviceStartDate; installation; acquisition
proxy; structured purchase date; legacy purchase date. Source field/type and proxy
status are explicit. Missing, invalid and future starts have null years, respectively
unknown/invalid/not_started. Genuine elapsed zero is preserved. Calendar validation
rejects invalid dates before Mongoose normalization. Age uses elapsed milliseconds
and 365.25-day years; rule evaluation uses unrounded age.

Expected-life resolution: approved Asset override; matching organization policy;
specifically adopted Asset benchmark evidence; validated provisional Asset/Template
legacy values; external reference evidence; unknown. Approved evidence requires
reference, actor, date and appropriate source type. Future/inapplicable evidence cannot
be adopted as-of; ambiguous organization policies are not chosen arbitrarily. Raw
Template defaults/eolYears and purchase.expectedLifeYears are never labeled approved.
Reference-only benchmark years are separately exposed and do not drive the rule or
resolved planning-life value. Positive legacy numeric life can support a labeled
provisional planning estimate, but cannot trigger an adopted age rule. Zero life is
invalid; disabled age policy is explicit.

Acquisition basis resolves only structured purchase price or legacy purchaseCost,
never replacement benchmarks. Recorded amounts retain field/source provenance.
Structured currency is used only if explicitly supplied; legacy currency is null.
Replacement resolves Template quoted price, then list price, separately, with available
source/report date/confidence. Missing currency/validity is null, not invented; future
or invalid report dates are flagged. Historical purchase is not replacement fallback.
No quote-expiration threshold or market forecast is invented.

Salvage preserves raw legacy zero but classifies it as default-ambiguous unless evidence
exists. Effective zero planning salvage is explicitly assumed under approved policy.
Estimated depreciation requires basis, usable start, positive life and usable salvage;
missing/nonfinite/conflicting inputs yield null with reasons. Salvage cannot exceed
basis. Accounting book value is separately unavailable: Cronus has no authoritative
accounting source in this scope.

The only configured replacement rule is adopted expected-life review. Output states
are recommended/not_recommended/insufficient_data with structured rule/reason codes,
inputs and generated text. Recommendation means review, never mandatory replacement.
The 1.5-times-maintenance heuristic is absent from canonical live assessment. No new
maintenance-based replacement rule exists.

## Additive schema and approval boundary

Asset adds optional serviceStartDate and nullable lifecyclePolicy. Purchase adds
optional currency and salvageEvidenceRef. Existing date/price/salvage fields are retained
without rewriting or changing persisted metric defaults. Organization adds an optional
per-Template lifecyclePolicies evidence array using a shared typed sub-schema.
Organization policy publication API/workflow is not introduced; no organization record
is populated by this change.

Existing authorized Asset PUT supports confirmed-date edits. Lifecycle policy
approval/clear is admin-only, requires evidence reference and positive life unless
explicitly disabled, and stamps approval actor/time on the server. Client approval
metadata, organization-source spoofing and malformed policy inputs are rejected.
Benchmark adoption binds to the current/new Template and cannot accompany removal.
Approval is evidence attribution, not automatic external benchmark certification.
No new cross-service collection access or Facility ownership transfer is introduced.

Mixed versions can read existing documents. Old writers cannot be assumed to preserve
new fields if they replace whole records; rollout should preserve additive metadata
and prefer forward repair. No migration/backfill is required for current API operation;
missing/provisional legacy evidence stays honest. Any future real-data enrichment,
policy publication or correction requires separate authority. Rollback retains all
new source/provenance fields; do not delete evidence as cleanup.

## API and frontend compatibility

GET /assets/:id/lifecycle adds assessment and retains assetId/templateId/purchase/metrics.
It preserves authorization, validates ID/Facility context, resolves organization from
the authorized Asset's Facility and scopes maintenance to that Facility. It does not
persist assessment or refresh Asset.metrics/WorkOrder caches.

Compatibility metrics are derived exclusively from the assessment and existing narrow
maintenance totals:

- currentBookValue is a deprecated estimated-depreciated-value alias, not accounting;
  missing value is null and no benchmark fallback is retained.
- yearsInService/annualDepreciation are nullable derived aliases.
- replacementRecommended is null for insufficient_data, true/false only for evaluated
  states; replacementAssessmentState accompanies it.
- projectedAnnualMaintenance stays observed internal labor + parts, not a forecast or
  silent directMaintenance redefinition; named scopes retain #7 meaning.
- costRecommendationStatus is not_configured; no economic rule is evaluated.

Asset detail consumes only canonical live assessment, never treats stored metrics as
current on absence/failure. It displays date state/proxy, resolved life/source,
separate capital values, unknown currency, salvage assumption and tri-state review.
It adds a labeled confirmed-date form field; clearing uses null. Primary maintenance
is Direct Maintenance Cost — Last 365 Days, with incomplete known subtotal and missing
components. Uncertified legacy CCR/book-value presentation does not determine policy.

LifecycleMaintenance adds optional explicit windowStart and excluded-completion-date
count. Asset endpoint supplies an exact rolling 365-day UTC window; both ends retain
the existing inclusive selection semantics and are disclosed. Scope calculations and
snapshot readers are unchanged; missing date exclusions are counted. Other consumers
retain their existing window defaults. No Template/Contract population or aggregation
code is changed. Legacy shared computeLifecycleMetrics, persisted caches, list/filter
and dashboard/forecast behavior remain for #11/#8, including known old heuristics.
This is a deliberate transitional boundary, not a claim of fleet-wide reconciliation.

## Branch verification

| Core suite | Passed |
|---|---:|
| Canonical assessment | 69 |
| Asset lifecycle endpoint and approval boundary | 33 |
| Legacy lifecycle utility compatibility | 3 |
| Template lifecycle compatibility | 152 |
| WorkOrder costs | 84 |
| WorkOrder subresource security | 339 |
| Operational ownership | 214 |
| Facility query isolation | 29 |
| Facility compatibility | 16 |
| Reference lifecycle / standalone | 103 / 31 |
| Test-equipment picker security | 49 |
| Supplier / vendor security | 59 / 90 |
| Procedure measurements | 78 |
| Other existing Contact/FollowUp/promotion/registration suites | 167 |
| **Full core, 21 suites** | **1,516** |

Contract full suite: **116/116**, 11 suites. Core authentication 31, Contract
authentication 23, vendor history 6, lifecycle job 11, amendment endpoint 13, value
endpoint 3, overview 4, profitability 3, value engine 16, canonical-cost adapter 3,
logging 3. No Contract source changes.

Frontend full suite: **279/279**. New coverage: lifecycle card 17, lifecycle API 3,
confirmed-date form 3; existing 256 unchanged. One new form test initially exposed
an unlabeled input; adding the actual label fixed behavior without weakening assertions.

App and tooling TypeScript pass with the existing --ignoreDeprecations 5.0 override.
Unmodified checked-in ignoreDeprecations 6.0 still produces TS5103 with installed TS5.6;
this baseline incompatibility is not changed. Independent Vite build passes, retaining
the existing large-chunk warning. CommonJS syntax and whitespace checks pass; ESM
maintenance loading is exercised by endpoint/compatibility suites. All six package and
lockfiles are byte-identical to baseline, with no dependency install/upgrade. Existing
cached modules were reused; temporary dependency symlinks are not commit artifacts.
Frozen evidence checksums remain unchanged. Synthetic GET tests prove Asset/WO raw
records remain unchanged and foreign-Facility maintenance is excluded.

## Deferred work and stopping boundary

#21 coverage, #11 aggregation and #8 cache/scheduler remain open and unstarted.
Future/backdated amendment coverage and new maintenance thresholds remain unresolved.
No real business-data write, Asset bulk migration/backfill, cache refresh, scheduler
enablement, runtime/container action, deployment, labor-rate publication, #19 work or
CRM change. #17/#18 stay closed and undeployed; no rate is approved. Stop after #20
controlled merge, fresh verification, pushes and verified issue closure.
