# Lifecycle cache scheduler — software controls and future enablement

#25 implements the [#24 operating model](<../engineering-journal/2026-10-12 - Gitea 24 Lifecycle Cache Scheduler Operating Model.md>).
Software completion does not deploy or enable it. Production remains on
43f953a1ec5e8cca1fe16b4381e512025d96c3c1 with both CRON_ENABLED=false and the
lifecycle-specific setting absent. Deployment, environment changes, restarts,
real-data refresh and enablement require separate operational authorization.

Configuration example (documentation only, disabled):

```dotenv
CRON_ENABLED=false
LIFECYCLE_CACHE_CRON_ENABLED=false
```

Only exact lowercase true enables lifecycle registration. Missing, empty, false
or malformed disables; malformed nonempty values emit configuration_warning.
Legacy Core global cron retains its exact-false opt-out behavior. Contract's
separate CRON_ENABLED and America/New_York scheduling are unchanged.

| Core global | Lifecycle | Legacy overdue/maintenance | Lifecycle |
|---|---|---|---|
|false|missing or false|off|off|
|false|true|off|on|
|true|missing or false|on|off|
|true|true|on|on|

Startup loads legacy registration under its original gate, connects Mongo, then
invokes the lifecycle starter. Module import alone creates no timers. Enabled
registration waits for DB readiness: */15 * * * * explicitly UTC, runOnInit=false,
no missed-run catch-up. Registration alone performs no refresh.

One designated Core instance owns scheduling. Ticks call the same
refreshLifecycleCaches as #22 with pageSize100/maxAssets1000 considered (including
fresh skips). No tuning env vars. Canonical source/CAS/freshness, Facility grouping,
policy and economics remain unchanged.

Ascending eligible ObjectId cursor is process-local only. Completed pages advance
despite failed/conflicted/expired members; fleet end resets null and later cycles
revisit them. Restart begins null. Query failure returns incomplete counts and last
confirmed cursor; remaining traversal unknown (hasMore=null), never silently complete.
Exceptions retain cursor, log safe error/end events, release guard and permit retry.
No retry queue, durable cursor, worker or lease.

Scheduler/shared writer both reject process-local overlap; skipped ticks never
advance cursor. SIGTERM/SIGINT stop new registration and drain active bounded work
before normal signal termination. Later traversal safely revisits interrupted work.

Structured JSON logs: job/event/UTC time, hostname:pid, versions, runId, start/end/
duration, considered/refreshed/skippedFresh/failed/conflicted/expired, failure Asset
IDs/outcome codes, previous/next cursor, hasMore/fleetEnd, incomplete/error/overlap.
Unexpected-exception counts unknown are null, not invented zero. No raw DB errors,
credentials, full Asset documents or business payloads.

Beginning-to-end runs fitting the cap dependency-check coverage for at most1000
considered members in100-member pages, with no assessment recomputation or writes.
Scope completed_traversal_members is not an atomic fleet snapshot; disappeared/
archived members are unavailable, not silently excluded. New inserts can await the
next cycle. Partial/resumed runs never claim full-fleet coverage. Coverage errors
remain explicit without losing refresh outcomes. Additional reads count in duration.

#24 thresholds: duration>=5min warning, >=10min/overlap stop/escalation; enabled
owner missing starts35min; any failed member review, repeated member3 visits;
coverage/integrity/source-write anomalies require attention. Logs suffice initially.
At>1000 eligible require capacity review:5000 capped traversal takesfive intervals/
~75min, exceeding common-hour validity. No distributed guarantee.

Initial target>=95% fresh at full-run samples and>=95% next-tick reconciliation,
duration<5min; between-run expiry gaps expected. Canonical live availability differs
from derived filter/forecast freshness.

Future rollout: separately authorize disabled-code deployment; verify health, SHA,
disabled registration, one owner and Facility scope; separately approve enablement/
config application/restart; observe runs, parity, write boundary, load and>=2h expiry
behavior. Both legacy flags stay false. Disable via lifecycle=false plus controlled
approved config/restart; no mutable runtime API. Prefer disabling/rolling forward.
#22 CLI remains separately authorized targeted repair/preview, not routine manual
scheduling. #19 remains BLOCKED; CRM remains paused.
