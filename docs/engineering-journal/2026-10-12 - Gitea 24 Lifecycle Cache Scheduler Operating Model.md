# Gitea #24 — Lifecycle cache scheduler operating model

Decision packet, 2026-10-12. Planning/readiness only. Recommendations below are recorded under the issue owner's #24 authorization; they are not implemented behavior or production enablement authority.

## Verified baseline and health at original #24 closure

Read-only checks preceded all writes. Local authoritative main, detached runtime HEAD, gitea/main, github/main and live remote main advertisements all equal `43f953a1ec5e8cca1fe16b4381e512025d96c3c1`. Runtime checkout `/home/thecapt/apps/cronus-main` supplies the existing Core/Contract/frontend service-directory mounts at /app. No main advance was observed. Documentation changes are left uncommitted; no branch, checkout, commit, push or runtime action performed.

**At original #24 closure, application health was not passing.** Core, Contract and frontend are stopped, exit143, finished on October10 at respectively 13:11:03.346265961Z, 13:11:03.402504043Z and 13:11:03.47810062Z. All have restart policy no; Mongo is running. Cause is unverified; exit143 alone does not establish an application bug. Zero Core instances currently run; one configured Core container is the existing intended owner after separately authorized restoration. Filtered container inspection confirms both configured CRON_ENABLED=false. No application was started. Bounded log tails establish historical activity only, not current availability or an exhaustive clean error history.

#24 was open; #19 is open with explicit BLOCKED status. CRM worktree /home/thecapt/apps/cronus is clean on feat/crm-interactions at `807bc38122e771dacccbc23fca4a66363dd58d55`. No CRM work occurred.

#23 completed evidence: [closure](http://192.168.1.185:3000/LiteRoc/cronus/issues/23#issuecomment-206), [five-Asset pilot](http://192.168.1.185:3000/LiteRoc/cronus/issues/23#issuecomment-202), [ten-Asset expansion](http://192.168.1.185:3000/LiteRoc/cronus/issues/23#issuecomment-204). Fifteen Mary Rutan materializations passed cache/live canonical parity, zero failed/conflicted/expired outcomes, no collateral source/business writes. Last measured fleet144 total/143 eligible; no new DB query or cache assessment was performed here. Pilot validity ended October7 at19:23/19:59UTC: if unchanged those envelopes naturally expired. This is timestamp inference, not newly observed cache state. ROLL-FORWARD NOW PREFERRED remains the posture. #20/#21/#11/#8/#22 are completed baselines.

## Scheduler inventory and current behavior

Repository-wide executable JS search found these registrations. Existing Core cadence has no explicit timezone and follows process-local time; Contract specifies America/New_York.

| Service/job | Flag/cadence | Registration and execution | Reads, writes, calls | Load/concurrency/readiness |
|---|---|---|---|---|
| Core overdue reminders | Core CRON_ENABLED; daily 0 0 * * * | src/cronJobs/cronJobs.js inline callback; notificationService.sendEmail/sendSMS | All non-Completed overdue WorkOrders, populated assignees. No explicit DB writes. Gmail/Nodemailer and Twilio sends. | Unbounded result list; serial external sends/costs. No overlap guard/deduplication. No independent gate or production activation proof; not certified safe to enable. |
| Core scheduled maintenance generation | Same flag; daily 0 0 * * * | Same file; scheduleMaintenanceJobs | Scheduled Assets/populated procedures; creates/saves WorkOrders, does not advance Asset nextMaintenance here. No explicit external calls; normal model hooks apply. | Unbounded candidates; serial saves; no overlap guard/demonstrated idempotency. No independent gate or production activation proof. Required Facility fields/repeated generation need separate review before enablement. |
| Core lifecycle cache refresh | Same flag; every15min | src/cronJobs/lifecycleScheduler.js → lifecycleCacheRefresh.refreshLifecycleCaches → lifecycleCache.materializePage/canonical assessment | Asset pages, Templates, Facilities, Organization policies and WorkOrder dependency/economic reads. CAS writes only Asset.lifecycleCache. No external service calls. | Current200/page,1000 considered/run, process-local cursor/guard. Same writer tested on15 production Assets by CLI; scheduled execution itself NOT production-tested. No independent gate today. |
| Core alternative planned maintenance — dormant | No local gate; midnight IF imported | src/cronJobs/maintenanceScheduler.js → maintenanceService.performPlannedMaintenance | Reads due Assets/procedures; creates WorkOrders, saves Asset schedule/workOrders references. No explicit external calls. | Unbounded list/output; no guard. No startup importer found. NOT activated by CRON_ENABLED=true today; do not import during lifecycle changes. No production proof. |
| Contract lifecycle/amendments | Contract CRON_ENABLED; 10 3 * * *, America/New_York | server.js → jobs/contractLifecycleCron.js → contractLifecycleJob.runContractLifecycleJob/amendmentLifecycleService | Activates/expires Contracts, applies due approved amendments; saves Contract status/metadata/amendments. No direct external call in job; normal service/model hooks apply. | Three candidate queries/unbounded arrays, sorted amendment references, serial saves/refetches. Singleton/noOverlap, no distributed lease. Isolated tests exist; no production cron activation proof. CRON_DRY_RUN exact true suppresses saves, not scheduling. |

Dormant module presence is distinguished from active registration. Shared variable names do not mean shared Core/Contract scheduling.

Core app.js loads dotenv and requires cronJobs/index BEFORE calling connectDB. Exact CRON_ENABLED='false' skips imports; any other value imports cronJobs (overdue + maintenance) and lifecycleScheduler (quarter-hour task). Notification clients initialize at import. Lifecycle module repeats the opt-out check. Missing, empty, FALSE,0 or malformed values fail open. Provider/dependency import errors may abort startup but are not an authorization control. No active callback executes immediately: direct maintenance call and notification startup IIFE are commented. Jobs wait for their next interval. There is no per-job operational suppression today.

Contract awaits DB connection, invokes the singleton starter, then creates/listens on app. Exact false disables; other values fail open. Starter records started even when disabled, so changing env later does not activate it. No immediate run. src/cron.js is a compatibility re-export of the same singleton, not another job. CRON_DRY_RUN is not independent enablement.

## Selected control and configuration

| Option | Decision |
|---|---|
| A: global only | Reject: lifecycle activation necessarily enables external reminders and business-data maintenance writes. |
| B: global + lifecycle flag | Reject for smallest change: global=true still registers unrelated jobs. Turning global into capability-only requires broader job-gate redesign. |
| C: independent lifecycle opt-in | SELECT: small import/registration split, explicit intent, independent rollout/disablement without collateral jobs. One new setting and test/documentation matrix are proportionate. |
| D: explicit allowlist | Defer: expressive but adds parsing/unknown-name and migration semantics unnecessary for three jobs today. |

Recommend Core-only **LIFECYCLE_CACHE_CRON_ENABLED**, independent of Core CRON_ENABLED. Only exact lowercase true registers; absent/empty/false/malformed disables. Default disabled, no default-on migration; malformed nonempty values log a sanitized warning. Global Core registration must stop implicitly importing lifecycle. Global=true/lifecycle absent activates only legacy jobs; global=false/lifecycle=true activates only lifecycle. Direct lifecycle imports use the same gate. Preserve unrelated global-job and Contract semantics in this small implementation. Both legacy flags remain false for future lifecycle-only rollout. Contract does not consume the new flag. Startup logs expose parsed effective control/cadence/bounds/owner/versions without secrets. Fixed scheduler defaults avoid additional config parsers; documentation and flag-matrix tests address env drift.

## Actual cache validity and cadence

lifecycleCache.expiry starts at assessment.asOf +60min. Maximum/common validity is one hour absent earlier transitions; calculation time reduces usable lifetime. No positive minimum: future service-start; adopted expected-life crossing; integer remaining-life/forecast boundary; future completed-WorkOrder inclusion; rolling365-day completion exclusion may be arbitrarily close. Exclusion transition is completion +365days +1ms, preserving inclusive boundary. Integer remaining-life boundary uses remaining minus (ceil(remaining)-1), times365.25days. These transitions may shorten validity to milliseconds. The one-hour ceiling conservatively covers continuous age/rolling-window drift.

Read-time freshness also rejects source fingerprint changes, invalidated metadata, invalid/future timestamps, missing Facility context, unsupported versions or payload integrity. Asset/Template/Facility-Organization/policy/WorkOrder changes may invalidate immediately before validUntil. WorkOrder fingerprints include relevant evidence beyond currently completed window members. No timestamp-only trust.

| Cadence | Daily considerations at143 eligible | Normal expiry-to-next-check gap (plus duration) | Assessment |
|---|---:|---|---|
|5min|41,184|<5min|3x15min scan/dependency load; better response but not necessary from current evidence.|
|15min|13,728|<15min|SELECT: four checks/hour, timely next-tick recovery with bounded current fleet cost.|
|30min|6,864|<30min|Longer stale/recovery windows.|
|Hourly|3,432|<60min|Near validity ceiling; jitter/early transitions can leave long stale gaps.|

Exact recommendation ***/15 * * * * in explicit UTC**. This is supported by one-hour maximum plus earlier invalidations, not simply copied from #8. Fresh-first remains correct: skip fresh, refresh stale/missing/unsupported/expired. Do not periodically rewrite fresh caches. Synchronized expiry can therefore produce nearly15min stale windows; quarter-hour operation is not continuous-freshness assurance. Errors/duration extend gaps.

## Workload, bounds and growth

Scheduler explicitly supplies **pageSize100, maxAssets1000**. These are scheduler-specific, not automatic reuse of CLI250/10000 bounds or current library200-page default. Considered includes fresh skips. Current143 eligible fits two pages and one complete traversal each tick. Approve all eligible Facility scope before future enablement.

| Eligible fleet | Pages/traversal | Considered/tick | Revisit at15min | Certification |
|---:|---:|---:|---|---|
|143|2|143|Every tick|Whole current fleet; at most143 cold writes.|
|500|5|500|Every tick|Conditional on measured duration/history/load.|
|1000|10|1000|Every tick|Upper initial cap, measurement still required.|
|5000|50,10/run|1000|Five ticks/~75min|NOT ready: revisit exceeds common one-hour validity.|

At500/1000 Assets daily considerations48,000/96,000;5000 capped remains96,000/day but with longer stale coverage. Writes depend on invalidation/expiry/CAS, not four fleet rewrites/hour. Before exceeding1000, require capacity review; separately reviewed max up to5000 could fit traversal/tick only after load gates pass (library permits10000). Otherwise cadence/worker/aggregation optimization needs separate design. Defaults do not certify5000.

Per page: eligible Asset query; Template/Facility/Organization queries + streamed WorkOrder dependency fingerprint cursor. Stale members add canonical totals + Facility/Organization reads per Facility group, current Asset re-read, three further dependency reads + another WorkOrder cursor, at most one CAS write/member. Tail uses empty page or Asset.exists. Fresh-only pages avoid assessment/recheck/writes but still read dependencies. No external APIs. Existing WorkOrder source defines assetId/status/deletedAt/completionDate index; no deployed index/query-plan performance proof taken.

Asset memory bounded by pages; total WorkOrder memory is NOT strictly bounded. Fingerprinting streams batchSize200, but canonical maintenance loads all completed WorkOrders for Facility/page with lean().find() and repeatedly filters per Asset. Long histories/embedded logs/parts increase memory/CPU. Template fanout and Facility count add cost; Asset count alone is insufficient.

5≈0.286s and10≈0.279s pilot timings do not establish a linear slope: fixed startup/connect/DB/driver effects are unknown. No credible duration prediction at143/500/1000/5000 from two tiny samples. Initial target <5min/run, warning>=5min, stop/escalation>=10min or overlap. Measure representative cold/fresh runs, peak resources and serving latency before capacity claims. API owner shares event loop/Mongo with live traffic.

## Traversal, failures and reconciliation

Ascending eligible Asset ObjectId keyset (_id>cursor), exclude deleted/archived. Process-local cursor advances after completed pages despite member failures; reset null at tail; next tick begins anew. No second sweep in same tick. Inserts/changes behind cursor appear next cycle. Restart begins null; fresh skips make repeats safe. Durable state unnecessary at whole-fleet-per-tick scale. Frequent restarts at larger fleets can starve tail, invalidating initial assumptions.

Choose **natural full-cycle retry (A) plus retained sanitized failure logs**, no explicit queue or separate sweep now. Cursor is traversal state, never a retry queue. Every tick revisits failed members when fleet<=1000. Persistent failures use deliberate #22 targeted preview/repair. No unbounded immediate retry or forced writes.

- Assessment failure/missing Facility/malformed inputs: failed, retain untrusted old cache, continue later members, revisit next traversal. Legitimate insufficient_data assessment is not automatically failure.
- Dependency change/optimistic conflict: conflicted, preserve newer/current input, recalculate next traversal; never count success or force overwrite.
- Expired-before-persist: expired/retry, no write, next traversal new asOf.
- Unsupported existing cache: refresh supported canonical envelope; invalid input failures stay explicit. Runtime version mismatch is deployment investigation.
- Page exception currently marks page failed and advances; required per-member IDs/reasons make reconciliation diagnosable. Bad-record isolation must permit later records to progress.
- Asset traversal query/DB timeout currently throws generic error, dropping returned partial counts/cursor; scheduler retains old cursor. Follow-up must return/log completed-page counts and resume state as incomplete, without fabricated remaining success. Next tick retries from last confirmed cursor (or safely repeats old pages if necessary).
- Unexpected exception: terminal incomplete/error, guard released in finally, next tick allowed. No permanent head-of-line stranding; distinguish considered, attempted and unknown/not-attempted outcomes.

## Ownership, concurrency and security

Choose **one designated Core API instance with process-local overlap guard**. Current configured topology is one Core container; no replicas specified, no concrete scaling plan found. At initial inspection zero were running; subsequent separately authorized recovery restored the one Core instance (receipt below). Exactly one enabled owner is a hard operational invariant; other instances disabled. CAS/source rechecks protect derived correctness but are not a distributed lock; preserve known cross-document recheck-window limitation. Coordinate manual CLI to avoid duplicate load.

No worker/lease now. Before multiple scheduler-capable processes, enforce one-owner topology or separately design Mongo lease/dedicated worker. Worker preferable if serving load/ownership becomes problematic. Cursor/identity/guard cannot prevent accidentally enabling two processes; verify effective owner count before rollout.

Internal batch is system-owned, not a user request: no broad admin API/JWT needed. Valid Facility required; WorkOrder dependencies pair Asset and Facility; totals group by Facility; policy follows Facility Organization and Template; CAS contains Asset ID+Facility/source revision/fields. Approved multi-Facility traversal must not pool economic facts or expose records across user scopes. Shared Template reference does not authorize cross-tenant aggregation. Preserve existing API authorization; regression fixtures test wrong-Facility WorkOrders/policies and unavailable context. No widened endpoint/privileges.

Logs contain times/counts/versions/cursor/owner and necessary opaque Asset IDs/error codes only. No assessment payload, serial numbers, financial values, policy/business documents, secrets or raw DB errors. Historical unrelated verbose logs are not a model to copy.

## Minimum observability, alerts and freshness SLO

Structured retained logs suffice today; no monitoring platform prerequisite. Startup effective control/registration; run-start and terminal completed/incomplete/error/overlap. Each run: UTC start/end/duration, runId, instance hostname/process identity, lifecycle/cache/policy/economic versions, considered/refreshed/skippedFresh/failed/conflicted/expired, previous/next cursor, hasMore/traversalComplete. Sanitized failure IDs/reasons support repeated-member investigation. Partial traversal is not fleet coverage. Current complete-fleet coverage samples need denominator/timestamp/dependency checks; outcomes at individual check times are not an atomic snapshot. Do not recompute all canonical parity every tick.

| Condition | Initial attention threshold |
|---|---|
|Enabled owner: no start|35min (two missed intervals+5min grace); urgent, distinguish stopped owner.|
|Failures/Mongo/runtime errors|failed>0 warning/review; aborted/systemic run urgent.|
|Repeated Asset failure|3 visits (~45min), targeted investigation.|
|Conflicted/expired|Always report; warn>5% considered or same Asset3 visits; one race is not corruption.|
|Duration|>=5min warning;>=10min or overlap stop/escalation.|
|Coverage|<95% fresh after two complete runs or>5% still stale next revisit: warning;>=20% stale after runs urgent.|
|Parity/integrity mismatch, unexpected source/business writes, unrelated cron activity, duplicate owners|Immediate stop condition; preserve evidence/roll-forward repair.|

Expiry between runs alone is normal, not noisy alert. Disabled/maintenance periods excluded from no-run alarm but not mislabeled healthy. Lightweight log review/checks initially; metrics/histograms/dashboard optional later. No alerts installed here.

Initial SLO for<=1000 eligible: **>=95% fresh at complete-run coverage samples** and **>=95% stale-detected eligible Assets reconciled by completion of next15min scheduled run**, target duration<5min (ordinary stale detection-to-reconciliation budget<20min). Failed/problem Assets remain in denominator; record exceptions instead of silently removing them. Two-run warm-up. No promise of continuous95% or time-weighted99%: stale-only refresh with synchronized hourly expiry cannot support that claim without measurements/design changes.

Live canonical detail availability is separate from derived freshness. When API/DB healthy, cache expiry/disablement preserves live detail; filters/forecast disclose incomplete coverage. Stopped apps at original closure meant live availability was not healthy; subsequently authorized recovery passed the availability checks below. Unknown lifecycle/business facts are not scheduler failure.

## Startup, disablement, rollout and incidents

Startup registers only after DB readiness, waits next UTC quarter-hour. No immediate full refresh, catch-up or jitter timer. If DB unavailable at tick, log failure/skip and await next, no overlap catch-up. This avoids startup load and fixes present Core pre-connect ordering in future implementation.

Disablement: lifecycle=false plus separately authorized controlled owner restart; no mutable admin config API. Stop new schedules on shutdown, drain current bounded run where possible; interrupted page leaves committed CAS caches intact, later traversal safely revisits. No rollback transaction. Static env changes may require Compose/container recreation to apply effective env, not merely file edit/restart; review actual mechanism. Caches naturally stale; healthy live detail continues, filter/forecast disclose gaps. Keep both legacy flags false.

Future enablement runbook:

1. Separately authorize #25 source work; review/tests; software completion remains disabled.
2. Reverify application health (October12 recovery completed separately). Authorize exact-code deployment with lifecycle false/absent and both legacy flags false.
3. Verify runtime SHA/mounts, app/DB/auth health, disabled logs/registration tests; approve all eligible Facilities, one owner, counts/load assumptions.
4. Obtain separate operational authorization for lifecycle enablement, representative preview/evidence scope, first bounded runs and necessary config/restart/recreation. No CLI apply automatically bundled.
5. Enable ONLY lifecycle on owner; legacy flags false. Controlled approved restart/recreation; verify effective registration; wait next tick.
6. Observe cold and fresh bounded runs, counts/CAS, representative equivalent-asOf parity/source-write boundary, peak memory/load/latency and coverage. Stop on listed conditions.
7. Observe>=2h spanning normal expiry/multiple traversals; declare steady state only after coverage/duration/no-unrelated-job gates pass, with recorded exceptions.

Incident posture ROLL-FORWARD NOW PREFERRED: disable responsible scheduling, preserve evidence, repair forward. Excessive load: pause runs, investigate WorkOrder/query/page cost before authorized tuning. Code/parity bug: disable lifecycle, canonical remains authority if healthy; repair/targeted authorized refresh, never delete cache envelopes to undo runs. Conflicts: investigate source writers/duplicate owner, never force writes. Unexpected business writes: stop/audit exact writer. Unrelated cron activation: disable affected global flag under runtime authority, audit notifications/WorkOrders/Contract effects; independent lifecycle flag cannot turn those off. No blind downgrade of data-aware code.

#22 CLI remains targeted preview, exact-Asset validation/repair, incident recovery and authorized one-offs; not routine manual operations or a retry daemon. Coordinate simultaneous use.

## Follow-up, required work and completion

One cohesive issue [#25 — feat: add independently gated lifecycle cache scheduler](http://192.168.1.185:3000/LiteRoc/cronus/issues/25), OPEN. #24 design prerequisite; #8/#22/#23 completed baselines. Dependency documented in body, not claimed as native Gitea link. Issue existence authorizes no implementation. Scheduler remains disabled after code completion; production enablement requires separate explicit operational authorization.

Required before enablement: strict independent gate/registration split; UTC15min,100/1000 bounds; DB-ready/no-immediate startup; one-owner rollout invariant; accurate partial-query/cursor outcomes and diagnosable natural reconciliation; structured logs/coverage; bounded shutdown; isolated flag matrix/traversal/retry/overlap/tenant/CAS/no-source-write tests and reviewed runbook/effective config. Reverify application health before enablement; October12 recovery has resolved the stopped-service gate.

Optional later: metrics/dashboard, durable cursor, retry queue/sweep, lease/worker, streaming economic aggregation/query optimization/scale-dependent indexes. Capacity gate above1000 may require revisiting these; no automatic authority to add them.

Documentation verification: git diff --check; only this journal and Current Context/Open Threads changed, no packages/locks/source changes. No application tests required for design. #25 title/body/state read back; #24 final comment/closed state verified and linked in completion receipt. Documents deliberately left uncommitted under repository Git authorization rules; deployed/remote main unchanged.

No scheduler enabled/invoked, no DB query or production cache/source/business writes, no runtime/env/restart/deployment changes, no source implementation, no #19 work/rate publication, no CRM change, no lifecycle/Contract-membership/#7 economics change. Stop after closure verification.

### Verified closure receipt

Complete packet posted as [#24 final comment224](http://192.168.1.185:3000/LiteRoc/cronus/issues/24#issuecomment-224); returned comment body matched the prepared packet exactly. #24 subsequently CLOSED and closed state read back. #25 exact title/body and OPEN state verified; #23 CLOSED verified; #19 remains OPEN/BLOCKED. Completion receipt retained locally at /tmp/cronus24-completion-receipt.json. Documentation remains uncommitted; complete decisions are durably retained in the issue comment.

### Post-host-rollback recovery and documentation checkpoint

After closure, the owner explained the October10 stop: Anton Windows host had a bad update and was rolled back to October8; the update remains unresolved and not reinstalled. Read-only post-rollback checks found no independent Cronus application failure. Mongo ping succeeded; lightweight counts matched #23:144 Assets/143 eligible,127 WorkOrders,73 Templates,2 Contracts,1 Organization,7 Facilities. This was structural verification, not a full integrity audit; no cache refreshed.

Under separate explicit recovery authorization, existing containers were started in reviewed order on October12: Core11:51:23.362603545Z, Contract11:58:59.447226137Z, frontend12:02:36.603189138Z. Both backends logged Mongo connected and schedulers disabled; Contract-to-Core unauthenticated probe401. Frontend200, Core/assets401 and Contract/contracts401 passed. No new startup/runtime error or scheduler activity detected; known Core duplicate workOrderId schema-index warning remains. Authenticated browser smoke not performed: no tool accessing the existing session. Both CRON_ENABLED=false, lifecycle-specific setting absent. Source and all three documentation hashes remained unchanged across recovery. No recreation/rebuild/install/cache refresh/business write or #25/#19/CRM work was performed. Local recovery receipt: /tmp/cronus-runtime-recovery-receipt.json.

This subsequent user-authorized documentation-only checkpoint commits exactly Current Context, Open Threads and this journal on a separate main checkout and pushes main to Gitea/GitHub. No scheduler decisions changed. Original uncommitted/no-recovery statements above describe the closure stage, not current state. Main may now be ahead of deployed runtime by this documentation commit. Detached runtime stays43f953a1ec5e8cca1fe16b4381e512025d96c3c1; its documentation copies remain preserved without reset/checkout. No container/runtime/config/source/database changes are part of the checkpoint. #25 remains unstarted.
