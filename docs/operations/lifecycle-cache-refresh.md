# Bounded lifecycle cache operator

`core-service/src/scripts/refreshLifecycleCache.js` is an offline CLI for separately
authorized operators. #22 provides software capability; it grants **no real-data
preview, refresh, deployment or scheduler authority**. #23 governs subsequent
operational approval. Do not run these examples against a real database.

The CLI follows the existing offline recovery-tool convention: OS access and
explicit application database credentials authenticate the operator. `--actor-id`
must resolve to an existing application administrator. The selected Facility must
be assigned in that user's `facilities` or primary `facilityId`; global admin read
access does not expand this tool's write scope. This is an offline privileged tool,
not an HTTP endpoint or a way to impersonate a user with only their ID.

Supply `MONGO_URI` through the existing approved execution environment. Do not put
credentials in flags, command history, output or documentation. The tool does not
load dotenv, application startup, cron, or indexes/collections automatically.
`autoIndex` and `autoCreate` are disabled. Output must be a new file, created with
mode 0600 and exclusive creation; an existing file is never overwritten.

## Exact-ID preview and apply

All IDs below are synthetic examples. Run from the repository root in an isolated
synthetic environment. An explicit Facility and maximum are mandatory in both modes.

```bash
node core-service/src/scripts/refreshLifecycleCache.js --preview \
  --facility-id 000000000000000000000001 \
  --actor-id 000000000000000000000003 \
  --asset-id 00000000000000000000000a \
  --asset-id 00000000000000000000000b \
  --asset-id 00000000000000000000000c \
  --asset-id 00000000000000000000000d \
  --asset-id 00000000000000000000000e \
  --max-assets 5 --page-size 2 --output synthetic-preview.json
```

Preview is the default. It writes **zero database/cache fields**. It reads the exact
cohort and verifies cache dependency fingerprints, which includes streaming relevant
WorkOrder evidence. It does not run canonical assessment. This is heavier than an
ID-only selection: budget and page size still apply. Output lists each Asset ID,
Facility ID, eligibility, cache state/reason, whether apply would attempt refresh,
and skip reason. Fresh records are skip candidates. Expiry is `stale` with reason
`expired`, preserving #8 states. Unsupported versions/integrity are `unsupported`;
missing caches are `missing`; legacy metrics are `stale`.

After review and **separate explicit operational approval**, the synthetic apply
example uses the same IDs and bounds. The apply gate follows the offline recovery
convention and is an additional guard, not proof of approval:

```bash
CRONUS_APPROVED_LIFECYCLE_REFRESH=yes \
node core-service/src/scripts/refreshLifecycleCache.js --apply \
  --facility-id 000000000000000000000001 \
  --actor-id 000000000000000000000003 \
  --asset-id 00000000000000000000000a \
  --asset-id 00000000000000000000000b \
  --asset-id 00000000000000000000000c \
  --asset-id 00000000000000000000000d \
  --asset-id 00000000000000000000000e \
  --max-assets 5 --page-size 2 --output synthetic-apply.json
```

IDs are validated as 24-digit hexadecimal ObjectIds, lowercased, deduplicated and
sorted. Unique IDs exceeding the budget fail before selection. Every explicit ID
must exist, belong to the requested Facility, and be non-deleted/non-archived (the
existing #8 refresh eligibility). A missing, foreign or ineligible member rejects
the **entire invocation before any write**, with unavailable IDs listed without
foreign data. Explicit IDs cannot widen to neighboring Assets and cannot combine
with a traversal cursor. Status eligibility remains #8's policy; this tool does not
invent a new Active-only lifecycle rule.

Apply uses the #8 refresh engine and `materializePage`, the sole canonical cache
writer. Fresh members skip. Stale/missing/unsupported members are assessed through
the live #20 batch implementation. Writes set only `Asset.lifecycleCache`: source
Asset facts, legacy metrics, Template, Organization policy, WorkOrders, Contracts
and vendor links are never edited. No repricing, rate lookup or lifecycle formula
is introduced. Existing envelope/version, integrity, expiry, source recheck and CAS
semantics remain. Older `asOf` cannot overwrite an already newer supported cache.

Preview is neither a reservation nor a lock. Apply reselects/revalidates the cohort
and source facts. Source edits can change outcomes; do not force a preview result.
In-process overlaps are refused. Separate processes may duplicate calculation;
dependency checks and CAS remain authoritative. Cross-document changes after the
last source recheck are not transactionally fenced; read-time fingerprints reject
stale results. This tool adds no distributed lease or transaction.

## Bounded Facility traversal

Omit `--asset-id` only for a deliberately approved bounded Facility traversal.
`--facility-id`, `--actor-id`, `--max-assets`, and `--output` remain mandatory.
Maximum range is 1–10,000; there is no implicit fleet operation. Page size range is
1–250, default 100. These bounds count **considered members**, including fresh skips,
not just successful writes. An empty authorized Facility reports zero members.

`--after-id` resumes ascending ObjectId traversal within that Facility. Output
`nextCursor` is the final selected ID only when further eligible members exist;
otherwise null. Apply selects its bounded cohort first and then passes those exact
IDs to the writer. A cursor is a traversal position, **not a failed-record retry
queue**. Population changes can affect later traversal; reconcile failures using
explicit IDs rather than assuming resume retries them.

## Outcomes and reconciliation

Structured output includes `selected`, `considered`, `refreshed`, `skippedFresh`,
`failed`, `conflicted`, `expired`, `nextCursor`, `hasMore`, and per-member outcomes.
For completed selection/apply, considered equals refreshed + skippedFresh + failed
+ conflicted + expired. Preview considered counts reviewed members; refresh counts
remain zero. Records disappearing/becoming ineligible after preflight are failed
`selection_changed` members, never silently omitted. Query failures retain completed
page outcomes and mark remaining exact members failed. Assessment/DB write failures
are failed; dependency/CAS/newer-evaluation conflicts are conflicted; expired
calculations were not written and require fresh evaluation.

The CLI exits nonzero for invalid options/authorization/selection, database errors,
overlap, failures, conflicts or expired calculations. Errors do not print connection
details or underlying sensitive messages. Connection/preflight failures may have no
considered cohort; inspect the structured failure rather than infer success. An
infrastructure failure may have partially completed pages. Reconcile per-record
results and current freshness before retry; never count conflicts as refreshed or
blindly rerun a larger cohort. Never reuse output files.

Schedulers are separate and unchanged. The manual tool neither requires nor sets
`CRON_ENABLED`, registers jobs, nor invokes scheduler callbacks. Operational
schedulers remain disabled. No production invocation was performed for #22.
