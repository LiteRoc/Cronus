# Gitea #25 — Independent lifecycle cache scheduler

Software implementation and verification, October12,2026. Deployment and
enablement are separate operational authorizations and were not performed.

## Baseline and reproduction

Authoritative local main and both live remote mains were
9b95f686947646b3db011f3cb65acaa6e0678779. Dedicated clean branch:
feat/gitea-25-independent-lifecycle-scheduler, worktree /tmp/cronus-gitea-25.
CRM remained clean on its paused branch at807bc38122e771dacccbc23fca4a66363dd58d55.
#25 was OPEN, #24 CLOSED, #19 OPEN/BLOCKED before work.

Production checkout /home/thecapt/apps/cronus-main remained detached at
43f953a1ec5e8cca1fe16b4381e512025d96c3c1 with its three preserved #24 documentation
copies. No modification of that checkout is part of #25. Read-only container
inspection recorded the recovered running containers, both CRON_ENABLED=false
and lifecycle-specific setting absent; no runtime/environment action authorized.

Original path: dotenv → app.js → cronJobs/index import before connectDB →
global exact-false opt-out → legacy overdue/maintenance plus lifecycle import →
import-time quarter-hour registration → shared bounded refresh/canonical cache
writer. Global true therefore activated all three; global false suppressed all.
Baseline scheduler/cache/native tests passed20/20 across3 suites.
Frozen index/lifecycle source fixtures from9b95f68 and couplingBaseline.test.mjs
retain the prior two coupling cases without invoking real callbacks or services.

## Implemented approved #24 decisions

Core-only LIFECYCLE_CACHE_CRON_ENABLED is strict exact lowercase true.
Missing/empty/false/malformed disables; malformed nonempty values produce
sanitized configuration_warning. Neither Core nor Contract global semantics
changed: existing Core overdue/maintenance retain global exact-false opt-out;
Contract implementation/timezone is byte-unchanged.

| Core CRON_ENABLED | Lifecycle flag | Legacy jobs | Lifecycle |
|---|---|---|---|
|false|missing/false|disabled|disabled|
|false|true|disabled|enabled|
|true|missing/false|enabled|disabled|
|true|true|enabled|enabled|

Index exposes an explicit lifecycle starter; app calls it after successful DB
readiness. Import alone registers no lifecycle timer. Library starter also
waits on connected when required. Startup errors are sanitized and contained.
No immediate refresh/catch-up; cron expression */15 * * * *, timezone UTC,
runOnInit=false, recoverMissedExecutions=false. Actual installed node-cron3
matcher and registration options are tested; Contract remains New York.

Runner calls exactly the shared refreshLifecycleCaches (#8/#22), pageSize100,
maxAssets1000 considered including skips, with optional failure/coverage reporting.
No new materialization path, policy/freshness/economic redesign or tuning env vars.
Process-local ascending ObjectId cursor advances through completed pages and
resets null at fleet end. New process starts null. Failed/conflicted/expired
members are visited again after wrap; one failure does not strand later pages.
No retry queue or durable cursor.

Shared refresh query failure now returns incomplete with completed-page counts,
last confirmed cursor and hasMore=null (unknown remainder), rather than dropping
progress through generic throw. Exact-ID operator outcomes retain existing
behavior and pass #22 regressions. Unexpected tick exception logs safe error/end,
retains cursor, releases guard, and allows later tick. Missing outcome entries
count failed rather than vanishing. Failure IDs and outcome codes are bounded
by considered maximum; no business payload/raw exception emitted.

Runner guard plus shared writer guard reject same-process overlap without
advancing cursor. Exactly one designated scheduler owner remains an operational
invariant; no lease/worker/multi-instance coordination. SIGTERM/SIGINT stop new
ticks and wait for bounded active run before normal signal termination. No data
rollback/deletion. The returned stop method is tested with in-flight work.

Structured JSON: registration enabled/disabled/config warning, run_start/run_end/
run_error, overlap_skip and stopped; UTC timestamps, start/end/duration, runId,
hostname:pid, cache/calculation/policy/economics versions, considered/refreshed/
skippedFresh/failed/conflicted/expired, failure Asset IDs, previous/next cursor,
hasMore/fleetEnd and unknown-remainder evidence. Counts unavailable on unexpected
exception are null. No metrics platform/dashboard.

When a single invocation traverses beginning-to-end, optional bounded coverage
rereads at most1000 considered members in100-member pages and validates source
dependencies through cache.inspectPage; no canonical recomputation/writes.
Scope completed_traversal_members is explicitly non-atomic, includes unavailable
members, and cannot claim an atomic population or fresh snapshot. New inserts can
await next cycle. Resumed/partial runs do not claim fleet coverage. Coverage errors
remain explicit without discarding refresh progress. Extra dependency read cost
counts in run duration. Capacity gate above1000 remains required.

## Verification

- Final broad Core:30/30 suites,1708/1708 tests.
- Final focused scheduler/native/traversal/legacy:6/6 suites,48/48 tests.
- Contract API/lifecycle/security:13/13 suites,205/205 tests; includes31 Core
  authentication and23 Contract authentication cases.
- #8 cache endpoints38/38, cache freshness16/16; #22 operator55/55.
- Broad Core includes lifecycle assessment/aggregation, Asset filters/forecast,
  WorkOrder economics, Facility/ownership/authentication and existing CRM
  regressions; running existing tests does not resume CRM implementation.
- Changed/new JS syntax and git diff --check passed. All6 tracked package/lock
  files byte-identical to baseline; no dependency installation/drift.
- No TypeScript/frontend change, so no frontend/type checks required.

Test targets inspected before execution: existing fail-closed loopback-only
MongoMemoryServer harnesses replace configured URIs with forbidden sentinel,
reject non-harness targets and disable downloads. Reused existing dependencies
through temporary worktree-local symlinks, no installs. Existing mongod8.2.6 binary
was read-only copied from the running container for ephemeral synthetic tests;
no production DB connection or container mutation. Node18 tooling emits its
known >=20.19 recommendation and known duplicate workOrderId index warning.
Sandbox denied native spawn/socket tests initially; required escalation rerun
passed. Early test-double defects were corrected without changing expectations;
startup fixture mocks now return a DB promise and explicit lifecycle starter,
while ownership/security assertions are unchanged.

Database-free native proof captures cron, prohibits real Mongoose connections,
injects only in-memory models, and executes actual canonical refresh:
1001 synthetic Assets; first tick considers/refreshes1000, second resumes the
last member/reset, third considers/skips1000 fresh; concurrent tick skips;
1001 synthetic envelope updates, zero source-fact changes. Legacy cron remains
unregistered. This is a mocked scheduling proof, not a production invocation.

Machine-readable test receipts retained locally under /tmp/cronus25-test-results.
Merged-main verification and exact branch/main SHAs are recorded in the final
[Gitea #25 verification comment](http://192.168.1.185:3000/LiteRoc/cronus/issues/25).
No runtime performance or production scheduler activation is claimed.

## Scope and operational boundary

Source changes: Core app startup, legacy/lifecycle registration separation,
small lifecycle runner, optional shared refresh outcome/coverage reporting.
Tests: frozen coupling, enablement/parsing/startup/cadence/cursor/overlap/errors/
shutdown, native shared writer proof, legacy callbacks, refresh traversal; six
existing integration fixtures updated only for asynchronous startup/runner API.
Docs: Current Context/Open Threads, this journal and
[disabled configuration/operator runbook](../operations/lifecycle-cache-scheduler.md).
No existing env sample was found; example is documentation-only and disabled.
No runtime Compose or .env changed.

#25 software complete; deployment and lifecycle scheduler enablement not performed.
Future deployment/enablement requires explicit authorization, exact runtime/source
verification, disabled-code deployment, one owner/Facility approval, controlled
config application/restart, bounded first runs/parity/write-boundary/load checks
and >=2h observation. Initial #24 SLO remains95% post-full-run freshness and
next-tick reconciliation, not continuously fresh coverage. Live canonical
detail/derived partial coverage remain supported when disabled.

No production checkout/env/container/database change, refresh or scheduler
invocation; no rate publication/#19 work, CRM change, lifecycle policy, Contract
coverage/aggregation or #7 economics change. ROLL-FORWARD NOW PREFERRED.
Stop after software merge/push/issue closure; no rollout begun.
