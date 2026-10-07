# Gitea #8 — Lifecycle Cache and Refresh Consistency

Date: October 7, 2026. Baseline main: `6ecb58714c8eab7b1797f72ed94a29df8854cb5c`.
Task branch: `feat/gitea-8-lifecycle-cache-freshness`.
Implementation and branch verification are complete. Final merge/ref verification and
closure evidence are recorded in [#8](http://192.168.1.185:3000/LiteRoc/cronus/issues/8).
Software delivery does not authorize deployment, scheduler activation or fleet refresh.

## Evidence and authority

Synthetic frozen source/reproduction in `core-service/evidence/gitea-8/` demonstrates
stale recommendation and maintenance filters, ignored calculation/policy/time metadata,
Template/maintenance source changes leaving old metrics queryable, unknown age treated
as zero in the old forecast, the scheduler's unimported mongoose reference and a native
CommonJS dependency-loading failure. SHA256SUMS preserves those baseline artifacts.
Permanent regressions exercise the corrected behavior with ephemeral persistence.

Live #20 Asset lifecycle assessment remains the authority. #21 current Contract
coverage and #11 aggregation contracts are unchanged. The cache writer calls the
canonical assessment service; no alternate lifecycle or economic formula is introduced.
The maintenance helper changed only its module interface to CommonJS, preserving named
and default imports. Native Node scheduler execution is tested without Jest's module
bridge, with all persistence mocked and scheduling forbidden.

## Derived cache contract

Additive Asset fields are `lifecycleCache` and `lifecycleSourceRevision`; neither has a
backfill/default. Existing metrics remain legacy compatibility data. The envelope carries
cache schema, lifecycle calculation/policy, economic calculation versions, assessment
as-of, calculatedAt, validUntil, source fingerprint, dependencies, canonical assessment
and payload integrity. Public list responses provide compact metadata rather than the
entire assessment. Freshness is calculated on read, never trusted from a persisted flag.

States are fresh, stale, missing and unsupported. Legacy metrics are stale, not fresh;
missing materializations remain missing. Unsupported versions or corrupted payloads are
unsupported. Identity/time integrity, authorized source context, fingerprint agreement
and unexpired validity are required for fresh. Live detail does not read or write cache.

Fingerprints use stable lifecycle-relevant Asset fields, resolved Template evidence,
Facility/Organization policy context and canonical WorkOrder snapshot/economic inputs,
status/completion/deletion fields. WorkOrders are streamed in bounded cursor batches;
current catalog prices/rates do not reprice history. Unrelated document edits are not
hashed. Missing referenced Facility context fails refresh safely.

Validity is capped at one hour and shortened for a future service start, adopted
expected-life threshold, forecast-year transition and maintenance window entry/exit.
The canonical rolling 365-day Completed/completionDate inclusive window is preserved;
an exit becomes effective one millisecond after its inclusive boundary. Time expiry
alone makes a cache stale even without source mutation.

## Invalidation and concurrency

Controlled Asset save changes increment a lifecycle revision and invalidate an existing
cache. Successful WorkOrder economic mutations best-effort mark affected Asset revisions
stale. This is metadata only; #7 snapshots/revisions/calculations are unchanged. Template,
organization, other WorkOrder completion/status/deletion/restoration and raw/query write
changes are detected by source fingerprints. Correctness does not require perfect hooks.

The writer rechecks dependencies before persistence and uses compare-and-set predicates
for prior envelope, revision and lifecycle Asset fields. An older calculation cannot
replace a newer envelope or changed Asset inputs. Cross-document edits after the final
read cannot be globally atomic with this predicate; subsequent read-time verification
rejects mismatched source inputs. This is not a distributed transaction or lease.

## Filter and forecast behavior

Lifecycle filters evaluate only fresh supported cache predicates and disclose eligible
population, fresh, stale, missing, unsupported and fresh insufficient-review counts.
Stale positives and negatives do not establish current evidence. Insufficient review
matches neither recommended nor not-recommended filters. Cache-state queries explicitly
label their different purpose. Tenant predicates and pagination remain intact; filtering
scans bounded pages and never computes live assessments synchronously.

Age filters use structured adopted-life rule results. The deprecated highMaintenance
parameter retains positive observed internal labor + parts semantics, labelled as such;
it is not silently changed to directMaintenance or a new replacement rule. Unconfigured
CCR policy requests fail explicitly instead of applying a free-text heuristic.

Forecasts use authorized Active/Inactive, non-archived/non-deleted Assets and canonical
fresh service age/adopted life only. Unknown inputs do not become zero. Coverage and
projection completeness are independent from currency/capital completeness. Stale or
unprojectable members remain unresolved in overall capital denominators. Known subtotals,
nullable complete totals and currency groups use #11 helpers; no FX or raw repricing.
The year denotes a useful-life review horizon, not mandatory replacement. Exact-member
drilldowns avoid broad legacy filters. Frontend list/table and forecast disclose partial
coverage even when no current rows can be charted.

## Refresh and scheduler

Refresh defaults to pages of 200 and at most 1,000 Assets per call (validated bounds:
page size 1–250, budget 1–10,000). Keyset cursors make work bounded/resumable. Missing,
stale, unsupported and expired caches are refreshed; fresh caches skip calculation.
Per-Asset failures continue safely and are counted. Page failures do not silently mark
success; reconciliation/retry can revisit them. Only derived cache fields are written.

An in-process lock prevents overlapping refresh invocations. There is no demonstrated
single-replica guarantee and no distributed lease: multiple processes may duplicate
compute, but optimistic writes prevent silent newer-result overwrite. Scheduler code
runs bounded resumable passes every 15 minutes when separately enabled, consistent with
the one-hour maximum validity, and periodically traverses the fleet for reconciliation.
`CRON_ENABLED=false` still prevents registration/import activation. No environment,
Compose, service or actual scheduler state was changed; no real refresh was invoked.

## Verification and compatibility

Pre-change gate: 1,554 core / 205 Contract / 305 frontend tests.
Final branch gate: **1,609 core tests (25 suites), 205 Contract tests (13 suites),
313 frontend tests (39 suites)**, all passed. This includes lifecycle #20/#11, Template,
Asset endpoint/filter/forecast, WorkOrder cost/security, ownership, Facility isolation
and compatibility, authentication, reference lifecycle, scheduler registration/execution;
Contract #21 coverage, lifecycle, overview/profitability, amendment/value, authentication,
vendor security/history and canonical-cost adapter; Asset/Template/Contract frontend
compatibility and new list/forecast regressions. Native scheduler probe passes without
real persistence or scheduling. TypeScript app/node checks pass using the established
`--ignoreDeprecations 5.0` override for the installed compiler; Vite build passes.
Changed JavaScript syntax, whitespace, frozen reproduction/checksums and exact baseline
package/lockfile comparisons are required before commit and again after merge.

Schema is additive and no data migration/backfill or index/dependency change is bundled.
Old caches stay stale. A future coordinated rollout must fence old writers/consumers:
legacy readers can still trust old metrics and cannot honor the new contract. Rollback
must preserve source facts and cache metadata, leave scheduling disabled and avoid
presenting legacy metrics as canonical. Prefer roll-forward for cache-aware consumers.
No production-scale benchmark or authenticated operational smoke was performed.
Read-time source verification is bounded in memory but still fleet-wide for full filter
coverage; large-fleet performance is a separately authorized operational concern.

Historical/as-of Contract coverage and any new maintenance replacement threshold remain
unresolved. #19 remains BLOCKED, no rate approved/published. CRM remains paused untouched
at `807bc38122e771dacccbc23fca4a66363dd58d55`. No real Mongo/business-data operation,
fleet migration/backfill, cache refresh, scheduler enablement, deployment or runtime/
container change occurred. Stop after #8 software closure.
