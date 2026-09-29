# Gitea #14: standalone reference reservations and explicit recovery

Implementation base: a8aea6fbe593840b4cbccead0a6565ccc2d9ede0. Code checkpoint: `1ead56c08174d26c899a47b002666f4e3c2a4bfa`.

Current status: **#14 deployed successfully at `7c3080305aa741805b68c09c38257578bda3bc4c`; startup/runtime verification passed. Authenticated first-use verification remains an open operational item, not a code blocker.** See the September 29 deployment record below.

## Accepted policy and coordination

Part and Manufacturer are shared master data. Only deletion metadata archives them; status labels remain business fields. Archived records are read-only. Historical references remain readable. No restore, Facility ownership, TTL, scheduler, background cleanup, or automatic recovery is introduced.

A new reference atomically acquires `referenceReservation` on the unarchived reference document only when unreserved. Archive uses the same unreserved predicate. A held reservation yields 409 to archive, competing new references, and ordinary edits of that reference. The guarded destination write persists a single private `referenceReceipt` and changes a private `referenceFence` in the SAME document write as its business mutation. A destination with a pending receipt refuses another reference write. Ordinary unlink/usage deletion preserves that receipt. The receipt is transferred durably to an operation record before clearing it. Work Order economics/CAS and captured pricing are preserved.

Reservation metadata contains a random operation token, operation type, destination model/ID, acquisition time (diagnostics only), and originating process instance/host/PID. Business-document coordination fields are private, excluded from ordinary reads/JSON and create/update allowlists. Operation records have no normal API endpoint. These additive optional fields need no backfill: absent/null reservation means unreserved; a malformed present reservation blocks writes/archive. No custom or TTL indexes are added. The new `referenceoperations` collection uses its built-in unique `_id` index, keyed by operation token.

Reservations, destination writes, and release use acknowledged journaled writes on standalone MongoDB. Success releases only the exact token. Definite pre-write/validation/duplicate/CAS rejection may release; uncertain/network/write-acknowledgement outcomes retain the token. Release is not in a finally block. A successful destination write is never rolled back because cleanup failed. Do not blindly retry a failed HTTP request whose write may already have committed.

## Recovery is offline and explicit

`core-service/src/scripts/recoverReferenceReservation.js` defaults to preview. It does not load dotenv, application startup, schedulers, or create indexes. Real-database access (even preview) requires separate operational authorization; this implementation work authorizes none.

Preview accepts `--model Part|Manufacturer --id ID --output NEW_FILE`, optionally `--token TOKEN`. Omitting token discovers a held reservation after a lost acquisition acknowledgement. Output files are exclusive-create, mode 0600. Treat recovery outputs as sensitive operational evidence. A preview does not change MongoDB state.

Apply additionally requires `CRONUS_APPROVED_REFERENCE_RECOVERY=yes`, `--apply`, the exact `--token` from preview, `--action release-committed|abandon`, `--actor-id ID` naming an existing admin, and `--reason TEXT`. The service independently requires an administrative caller and reason. There is no mounted HTTP recovery endpoint.

- `release-committed`: the durable destination receipt must match destination ID, token, operation, reference model and reference ID. A matching pending receipt or journaled committed operation proves the write committed even if its live link/usage has since changed. The writer cannot replay the update/usage after receipt removal: destination CAS requires the immutable predecessor fence recorded before dispatch, and the write replaces that fence with its own unique token. Later writes never restore an older fence. Creates have a fixed unique destination ID.
- `abandon`: a missing receipt alone is NOT proof that writing has stopped. Explicit operational quiescence evidence is mandatory, followed by a new absence check. Committed, malformed, unavailable or otherwise uncertain outcomes cannot be abandoned.
- Every recovery release first journals its outcome and one immutable audit entry on the operation record, then clears only the matching destination receipt and source reservation, and finally marks the operation released. Repeat recovery finishes interrupted cleanup or returns the recorded result without duplicating audit or clearing a newer token. Reason text is limited to 1,024 characters and evidence text to 4,096; only the documented quiescence fields are persisted.

## Abandonment precondition: operator-verified quiescence

The tool cannot remotely establish process/network/database quiescence merely from timestamps, missing rows or a PID. Abandonment must be performed under a separately authorized operational procedure which establishes BOTH:

1. The original process instance is terminated or otherwise fenced so it cannot resume this operation (including any retry/queued task).
2. All of that operation's in-flight/buffered database requests have completed or been eliminated; none can later commit. Merely killing a client, waiting an arbitrary interval, or observing no receipt is insufficient.

If these conditions cannot be independently verified, DO NOT approve abandonment; retain the reservation. A still-active writer in the same process is additionally rejected by the service. No automated cross-host verification is claimed. The evidence file is an administrator's explicit attestation backed by operational evidence, not a programmatic proof or a bypass for a live writer.

Supply `--quiescence FILE` with these fields:

```json
{
  "token": "EXACT_PREVIEW_TOKEN",
  "writerInstanceId": "EXACT_PREVIEW_WRITER_INSTANCE",
  "writerStopped": true,
  "databaseRequestsDrained": true,
  "verifiedBy": "APPLY_ADMIN_ID",
  "evidence": "Reference to independently verified process fencing and database-request completion evidence"
}
```

The token, instance, verifier and both positive assertions are required and copied into the atomic recovery audit. No operational fencing/restart/kill command is executed by this tool. It does not infer that a remote writer is dead or that an absent receipt is safe to abandon.

## Bounded business metadata and operation retention

`ReferenceOperation` stores one document per UUID token in `referenceoperations`. Its states are `reserved` → `committed` or `absent` → `released`; `outcome` retains the terminal decision. Each document has fixed-shape correlation, writer identity, the immutable predecessor fence, and at most one bounded recovery audit. There are no history arrays.

Acquisition journals the source reservation, reads the destination fence, then inserts the operation record before dispatching the dependent write. Failures anywhere in preparation retain the source reservation, which contains enough correlation for explicit recovery even if the operation insert never occurred. A competing destination write may cause a safe CAS rejection; no reservation or receipt is overwritten.

After the dependent write, its receipt is journaled into the operation's committed outcome BEFORE removing the business receipt. Cleanup removes the exact-token receipt, clears the exact-token source reservation, then journals `released`. A crash at any step leaves either the pending receipt or durable operation proof. Recovery can resume even when the source is already unreserved or has a newer token. The newer token is never cleared. Definite no-write outcomes use the same process with `absent`; uncertain absence still requires the documented quiescence evidence.

Part and WorkOrder retain only a single constant-size replay fence after cleanup; Part/Manufacturer retain at most the current source reservation. No business document accumulates receipt or audit arrays. Operation document count grows with operations, intentionally: terminal records remain durable tombstones for deterministic repeat recovery. This change does NOT claim bounded total collection size, implement deletion/compaction, or infer safety from age. Any future pruning requires a separately reviewed protocol preserving recovery/idempotency. Unresolved records are always retained.

There is no backfill or migration, including for documents without metadata. The superseded synthetic array format was never deployed, so it needs no compatibility migration. The collection is created on the first operation insert; application database credentials need ordinary collection creation/write permissions (or separately approved pre-provisioning). The model disables automatic collection/index initialization; preview cannot create it. No startup cleanup, TTL, transaction, replica set, or application configuration is introduced. Operational storage/backup planning must include this collection. Deployment still requires fencing old non-participating writers.

## Compatibility and rollout boundary

The #14 paths require no transactions or replica set. Existing independent transaction features elsewhere are untouched. All reference/archiving writers must use this protocol; do not mix an older archive implementation which ignores reservations with new writers. Deployment sequencing and any real-data recovery require separate approval. Pricing timestamps and business audit fields are not changed by acquisition, release or recovery; recovery has its own audit trail.

Frozen reproduction evidence remains untouched. Permanent standalone tests cover competing requests, both race orders, lost acquisition/write/cleanup acknowledgements, retained receipts, no expiry, exact-token/repeated recovery, quiescence refusal, safe explicit abandonment, privacy and unchanged pricing. Broader compatibility verification is recorded in the task handoff.

## Verified pre-deployment test results

Focused lifecycle/retention/recovery: 134 tests passed. Backend compatibility: 680 tests across six suites, including those 134 #14 checks and 546 existing ownership/security/compatibility/cost regressions. Frontend compatibility: nine tests across two suites. Total unique tests: 689. No real-data access or deployment occurred during that test phase. Frozen reproduction checksums and diff-whitespace checks were verified at the implementation handoff.

## September 29, 2026 — deployment and operational verification handoff

**Controlled deployment completed successfully** at runtime SHA `7c3080305aa741805b68c09c38257578bda3bc4c`, verified on Gitea and GitHub before deployment. The stable checkout `/home/thecapt/apps/cronus-main` was clean before and after advancement from `c3f0966df5c3d9ccbdb57af5f968bd6d0f77f639`.

The user authorized a private maintenance window. Three samples found no active application connections and the preceding five minutes of app logs contained no requests. All three application containers stopped together before the shared checkout advanced. Old Node/watch processes were confirmed gone; two read-only Mongo checks found zero old-backend connections and zero active client operations. Core, Contract and frontend then started in order. Normal access was released after verification. No firewall, reverse-proxy, published-port or networking configuration changed.

Existing application containers were reused, with new process start times (UTC):

| Service | Unchanged container ID (short) | Previous start | New start |
| --- | --- | --- | --- |
| Core | `efb934aa68e7` | 2026-09-25 12:35:53 | 2026-09-29 09:10:21 |
| Contract | `86d58510ae99` | 2026-09-25 12:37:13 | 2026-09-29 09:11:21 |
| Frontend | `c2cfb3b6debe` | 2026-09-25 12:39:21 | 2026-09-29 09:12:01 |

Mongo remained `eb448adced26`, continuously running since 2026-08-13 09:58:17 UTC. All four restart counts remained zero. Compose override hashes were unchanged; both backends retained `CRON_ENABLED=false` and logged disabled schedulers. No migration, backfill, topology or configuration change was required.

Startup/runtime verification passed: source mounts and selected source fingerprints matched, both backends connected to Mongo, protected endpoints returned 401, and the frontend shell plus ten modules returned 200. No startup errors, credential-leak markers, transaction/replica-set errors or unexpected Mongo structural events were observed in the checked logs. Core's duplicate `workOrderId` schema-index warning was confirmed to predate deployment.

The #14 model loaded against authorization-disabled standalone WiredTiger Mongo. Read-only metadata checks confirmed automatic collection/index creation was disabled, no custom model indexes were declared, and `referenceoperations` was absent. No write probe forced collection creation. **First-use creation/use of `referenceoperations` remains unverified in production.** Startup compatibility does not establish a successful protected write.

Database-free synthetic checks against the deployed #7 calculation module passed: captured prices remained unchanged by catalog prices, quantities used captured unit prices, and reads preserved revision and timestamp. The calculation module was unchanged from the previous deployment. These checks do not replace authenticated production pricing/snapshot verification.

Authenticated operational smoke was not performed because no approved admin session/credential source was available. No credentials were created, extracted or exposed, and no production lifecycle/reference writes were performed for smoke testing. Active-reference creation, archived-reference and ordinary-edit rejection, historical-reference readability, operation journaling and authenticated pricing/snapshot checks remain unverified in production. No authenticated API outcomes were recorded.

Authenticated first-use verification remains an **open operational item, not a code blocker**. Follow-up requires an approved existing admin session and Facility context, minimum safe application writes and cleanup only through supported application behavior. After #14-aware writes begin, prefer roll-forward; blind rollback remains unsafe. Do not delete reservation/operation metadata as rollback cleanup.

The next development item is **#15 — Template lifecycle authorization**. This documentation handoff does not start #15 or #9, change rates or CRM, run migration/backfill/repair/recovery/import scripts, or enable schedulers. The deployed runtime remains at the SHA above.
