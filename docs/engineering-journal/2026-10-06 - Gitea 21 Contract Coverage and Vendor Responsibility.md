# Gitea #21 — Contract Coverage and Vendor Responsibility

## Status and authority

Current-state software implementation and branch verification complete; deployment not
performed. Controlled merge, fresh merged-main checks, pushed SHAs and closure are
recorded separately in the final verification comment on
[#21](http://192.168.1.185:3000/LiteRoc/cronus/issues/21). This entry does not claim
production verification or completion of #11/#8.

Owner-approved invariant: **vendor responsibility is contained within resolved current
Contract coverage**. A vendor may cover all members. Complementary overlap is permitted;
no blanket exclusivity or historical reconstruction is approved. Policy authority:
[Lifecycle Policy Decisions Approved](<2026-10-06 - Lifecycle Policy Decisions Approved.md>).

Baseline main/Gitea/GitHub: `5e9fdfdef16f4b0afac87d31ef70612fc39f2646`, containing
closed #20. Task branch `feat/gitea-21-contract-vendor-coverage` uses the existing
non-runtime `/tmp/cronus-facility-query-isolation` worktree. Relevant worktrees/staging
were clean before writes. Runtime checkout remains untouched. CRM remains paused and
clean at `807bc38122e771dacccbc23fca4a66363dd58d55`. #17/#18/#20 were verified closed;
#21 open; #11/#8 open/unstarted; #19 open/BLOCKED.

## Before evidence and inspected paths

`contract-service/evidence/gitea-21/` freezes baseline creation/update, lifecycle
and amendment-application function bodies (only trailing separator blank lines omitted), a standalone VM reproduction, observed
JSON and checksums. Eight synthetic assertions reproduce accepting unvalidated
out-of-coverage/missing/cross-Facility references, silently dropping invalid IDs,
retaining duplicates, adding out-of-coverage IDs during update, expanding lifecycle
population from A to A+B, and leaving responsibility outside membership after an
applied removal. Existence/Facility cases demonstrate absence of any Asset lookup in
these frozen mutation functions; they do not claim production data anomalies.
Complementary parts/labor responsibility records survive the frozen removal example.
Re-running the reproduction matches observed output byte-for-byte. No operational
records, credentials or copyrighted benchmark data are evidence fixtures.

Inspected mutation authority: Contract creation initializes coveredAssets; only applied
amendments mutate that current snapshot through computeAmendmentImpact and
applyApprovedAmendmentToContract. Draft/submitted/approved amendments are separate
records. Vendor creation, commercial PATCH and add/remove paths modify embedded links.
The runtime lifecycle controller previously unioned vendor references into membership.
Overview/profitability already used coveredAssets for general populations, but vendor
hydration/leakage subsets could still include anomalous outside references. Asset active
Contract lookup already queried coveredAssets; Asset coverage receipts accidentally
overrode a Facility `$or` with a membership/amendment `$or`. A synthetic cross-Facility
receipt test reproduces the importance of retaining both predicates.

## Current coverage and responsibility boundary

`currentContractCoverage.js` owns a small pure current-snapshot resolver: normalized,
deduplicated ObjectIds in first-seen order, invalid-reference count and explicit
historicalReconstructionSupported=false. It reads no vendor IDs, amendment dates or
financial timeline and persists no second membership source.

Responsibility resolution returns the intersection with current coverage, retaining
outOfCoverageAssetIds and invalidReferenceCount as anomaly evidence. Inspection is
read-only and reports per-link anomalies and overlaps. Stored anomalous assignments
remain untouched; current analytics do not treat them as valid members. Inspection
requires an already authorized Contract; no new fleet/admin audit endpoint or data
repair script was introduced.

Vendor creation/add batches reject malformed IDs/arrays, unavailable Assets, out-of-
coverage members, mismatched Contract/selected Facility and cross-Facility/archived/
deleted Assets. Authenticated per-request core GET /assets/:id provides existence and
visibility; the returned identity/Facility is independently checked. Upstream denial
is a non-sensitive business error; upstream outage fails closed without saving. No new
cross-service collection access or shared mutable credentials are introduced.

Duplicates normalize. Duplicate additions and absent removals are idempotent; the same
ID in add and remove is rejected as ambiguous. The proposed entire result is checked
before mutation/save; an invalid batch cannot partially add/remove or append history.
Commercial PATCH cannot silently affirm an out-of-coverage existing assignment. Existing
one-link-per-vendor behavior is retained, not broadened into one-vendor-per-Asset.

## Overlaps, removal and concurrent edits

Parts-only plus labor-only is explicitly classified complementary and accepted. PM,
T&M, other and full scopes do not encode enough exclusions or allocation authority to
infer exclusivity. Other overlaps, notably full/full, are accepted but surfaced as
responsibility_overlap_requires_review with exclusivityPolicy=not_configured. No date-
based active/historical overlap resolver or exclusive allocation engine is invented.

Amendment application checks proposed current membership before changing either
coverage or amendment status. Remaining outside references yield HTTP 409 with
vendor_responsibility_conflict and disposition metadata. Preview exposes the proposed
conflict without saving. Explicit authorized responsibility disposition must precede
application; no silent pruning/expansion occurs. The check deliberately includes stored
links regardless of date because historical responsibility policy is not established.
Other pre-existing anomalies also fail closed rather than silently surviving a coverage
change. There is no real-data remediation in this task.

Additive responsibilityHistory records prospective explicit before/after membership,
actor and time on vendor Asset edits. Initial creation remains represented by the link;
legacy history is not manufactured. History is not fed into current membership and is
not pruned by coverage removal. No commercial-field history redesign is bundled.

Contract document saves use existing __v optimistic concurrency for coveredAssets and
vendorLinks only. Coverage removal and vendor assignment cannot overwrite each other
from stale reads. A synthetic versionless-record test caught an initial-write race;
a conditional __v-absent predicate now guards that first write and clears after
successful save. Tests cover both race directions and reuse of the saved document.
Version/document conflicts on #21 mutation paths return HTTP 409 and require reload.
No version backfill is executed. No-op duplicate updates remain safe.

## Reads, frontend and compatibility

Lifecycle hydration/population uses only resolved current Contract members, deduplicating
and intersecting returned batch rows as well. Vendor-only Assets cannot influence counts,
capital sums, candidates or recommendation denominators. #20 live Asset lifecycle
metrics are still consumed. Existing capital completeness/labels and legacy metric
aliases are not redesigned; #11 remains the aggregation owner.

Overview/profitability use the same membership boundary; vendor analytics use the valid
responsibility intersection. Raw IDs remain in vendor responses alongside responsibility
metadata and valid responsibility counts, so anomalies do not disappear. Vendor payouts,
financial timelines and canonical #7 economics remain unchanged. Asset active lookup
retains its current-coverage query; the receipt query now combines Facility and
membership/amendment predicates rather than replacing Facility scope.

Contract UI vendor picker offers only hydrated current Contract members. Existing outside
or unavailable assignments remain visible with explicit removal controls. Backend remains
authoritative. Vendor rows warn about anomalies; uncertain scope overlaps warn for review.
Explicit assignment edits precede commercial PATCH so anomaly disposition is possible;
these remain separate API requests, not a new transaction. Errors prompt reload to review
saved state. Amendment apply conflicts are displayed; preview warns before application.
Types and API regression tests preserve additive response metadata. No broad UI redesign.

## Verification

Baseline: core 1,516 / 21 suites; Contract 116 / 11; frontend 279 / 33.
Branch full gates: **core 1,516 / 21; Contract 199 / 13; frontend 292 / 36**, all passed.
New tests: 27 pure coverage/validation regressions and 56 endpoint/integration regressions;
frontend 6 picker, 4 Contract detail and 3 API tests. Existing assertions were not weakened.

Contract suites include authentication (core 31, Contract 23), vendor history 6,
lifecycle jobs 11, amendment endpoints 13, value endpoint 3, overview 4, profitability 3,
value engine 16, canonical economic adapter 3 and logging 3, plus the new 83 regressions.
Core includes #20 assessment 69/endpoint 33, legacy lifecycle 3, Template compatibility
152, WorkOrder cost 84/subresource security 339, ownership 214, Facility query isolation
29/compatibility 16 and existing reference/other suites. Synthetic tests bridge real
Contract routes through per-request Axios clients to actual authenticated core Asset
routes; external calls are allowlisted in-memory, not sent to runtime services.

Harnesses were inspected: configured/arbitrary Mongo targets are refused, only issued
loopback ephemeral URIs connect, binary downloads are disabled and cached binary is
explicit, providers mocked, cron disabled/controlled. Sandbox socket denial requires the
approved execution boundary; this does not authorize or access real Mongo. Test records
are synthetic and removed with their ephemeral stores.

Both TypeScript projects pass with the previously documented ignoreDeprecations=5.0
command-line override. Standard checked-in 6.0 still conflicts with installed TypeScript
5.6 (baseline TS5103); configuration/dependencies are unchanged. Vite passes with the
existing chunk-size warning; build output stays in /tmp and is not deployed. Changed JS
syntax, git diff --check, frozen reproduction/checksums and all six package/lockfile
byte comparisons pass. No dependencies installed or upgraded.

## Rollout, data and unresolved limits

No migration/backfill, vendor cleanup, Contract expansion/pruning or real-data audit
was performed. Existing __v is reused; missing versions are conditionally initialized
only on an eventual authorized normal save. History is additive and defaults empty on
hydration, without manufacturing past events. Future rollout must fence older writers
that bypass validation/version predicates or discard history. Prefer roll-forward;
downgrading could restore union/mutation defects and lose newly recorded history.
Malformed legacy references can require separately authorized evidence-based remediation;
normal mutation APIs do not silently coerce/drop invalid references. Asset validation
and Contract save are across services, not a distributed transaction; they preserve
current per-request authorization and do not introduce cross-service locks.

Future/backdated amendment effective-date behavior and historical/as-of membership
remain unresolved. Applied changes still affect today's snapshot under existing current-
state behavior; this work neither selects effective-date policy nor reverses membership
from financial timelines. New maintenance-based recommendation thresholds remain
unapproved. #11 aggregation and #8 cache/scheduler are open/unstarted and require later
assignment. No Asset cache refresh, scheduler work/enablement, deployment, runtime/
container operation, rate publication or #19 work. CRM remains paused/untouched.
