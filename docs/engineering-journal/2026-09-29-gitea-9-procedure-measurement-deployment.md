# Gitea #9 — Procedure measurement units deployment

Date: September 29, 2026. **Deployed successfully at `41c470914b209925aad944e747d9939de3add801`.** Controlled deployment and startup/runtime verification passed. Authenticated #9 production smoke remains pending because no approved session/safe record scope was available. No authenticated production measurement writes were performed.

## Result authority and history

WorkOrder embedded procedure results are the canonical measurement source. Current TaskResult responses derive from that WorkOrder state; legacy TaskResult documents remain untouched historical evidence, not a second current authority. Attachments capture unit/custom label, lower/upper bounds and required state independently of later source Task edits. Legacy missing snapshots remain unknown; no inference, conversion or backfill occurs.

Readings must be finite numbers. Bounds are inclusive evaluation criteria: out-of-range numbers persist as completed, failed measurements. Required readings cannot be bypassed with malformed status shapes. Completion does not imply pass. Controlled units include dimensionless and exact custom labels; display avoids duplicate suffixes.

## Controlled deployment

Both remote main refs matched the target. The clean stable checkout `/home/thecapt/apps/cronus-main` advanced from `a62c96686bcaad74bba00fa64fc5fba31996b8b4` only after frontend, core and contract stopped together. No rolling deployment or live bind-mount update occurred.

Three samples found zero active application connections and the preceding five minutes contained no HTTP requests; a final inactivity check preceded stopping. Old Node/watch processes exited. Two read-only Mongo operational samples found zero old-backend connections and active operations; no business records were queried. Core, Contract and frontend started in order. No networking configuration changed.

| Service | Unchanged container ID | Previous start UTC | New start UTC |
| --- | --- | --- | --- |
| Core | `efb934aa68e7` | 2026-09-29 13:22:14 | 2026-09-29 18:32:31 |
| Contract | `86d58510ae99` | 2026-09-29 13:22:33 | 2026-09-29 18:35:17 |
| Frontend | `c2cfb3b6debe` | 2026-09-29 13:22:34 | 2026-09-29 18:35:53 |

Mongo `eb448adced26` remained continuously running since August 13, 2026, 09:58:17 UTC. All four restart counts remained zero. Both backends retained `CRON_ENABLED=false` and logged disabled schedulers. Compose override hashes were unchanged; the deployment checkout remained clean.

## Verification and limits

- Fresh-main verification passed 927 tests: 78 measurement backend, 509 ownership/security, 286 #14/#15 lifecycle, 21 #7 pricing/snapshot and 33 frontend tests. Syntax, whitespace and TypeScript passed with the documented `--ignoreDeprecations 5.0` override. Exact-lock verification remained valid; manifests/lockfiles were unchanged.
- Deployed fingerprints matched 152 core, 53 contract and 195 frontend tracked files. Both backends connected to Mongo. Twelve unauthenticated protected-route probes returned 401; frontend shell and five affected modules returned 200. An initial probe used the unmounted `/api/workorders` path and returned 404; the corrected `/workorders` authentication probe passed.
- No new startup/index errors or Mongo structural/error events were detected. The known duplicate `workOrderId` schema-index warning predates #9. #14/#15 lifecycle startup behavior remained intact; their authenticated first-use smoke items remain open operational verification items.
- Database-free checks against deployed modules passed for #7 captured pricing, quantity calculation and read immutability, plus #9 snapshot preservation, recorded out-of-range failure, required absence and numeric-string rejection. These do not establish authenticated production measurement behavior.
- Deployed source inspection confirmed canonical WorkOrder writes and derived current TaskResult responses, with no legacy TaskResult rewrite/backfill or new Procedure/WorkOrder startup mutation. No authenticated production measurement writes or business-record queries were performed for verification.
- No migration, backfill, new collection/index, topology, dependency or configuration change was required. No new transaction/replica-set requirement appeared. No images were rebuilt, dependencies installed, or migration/import/repair/recovery scripts run.
- All 276 frozen evidence checksums and the archive remained unchanged. Sanitized deployment evidence is retained locally under `/tmp/cronus-gitea-9/deployment-verification/` (`preflight.json`, `drain.json`, `startup.json`, `completion.json`); this local directory is not a repository artifact.

## Browser reload, pending smoke and rollback

**Require browser reloads before normal access resumes.** Stale tabs may submit obsolete result payloads or retain old unit/evaluation display behavior; backend validation remains authoritative. Normal access was cleared to resume after reload.

Authenticated #9 production smoke requires an approved existing session and safe record scope, including separately authorized writes/cleanup. No session was created or credentials extracted. #14 and #15 authenticated first-use checks also remain pending; this deployment does not close them.

**After #9-aware writes begin, prefer roll-forward.** Old writers can omit/drop measurement snapshots and resume independent TaskResult writes. Fence and drain them during any rollout or rollback. Never reconstruct current results from legacy TaskResult documents. Preserve measurement snapshots and #14/#15 lifecycle/audit/reservation metadata; any recovery remains separately reviewed and authorized.

## Documentation-only handoff and next phase

Repository main and deployed runtime were both `41c470914b209925aad944e747d9939de3add801` before this documentation checkpoint. This handoff changes documentation only and does not advance runtime.

The next planned phase is **Lifecycle/Contract reconciliation**, not started here:

1. Reconcile Asset/Template lifecycle calculations with Contract lifecycle intelligence.
2. Confirm Work Order cost flow into lifecycle and Contract analytics uses the approved #7 canonical cost model.
3. Identify remaining duplicated or inconsistent lifecycle/economic calculations.
4. Then evaluate **AHA 2023 Estimated Useful Lives of Depreciable Hospital Assets** as a benchmark/reference source for lifecycle defaults and source attribution.

Do not commit the AHA PDF to Git. Useful lives are benchmark/reference values, not automatic replacement mandates. Do not bulk-copy copyrighted tables into source code without confirming permitted use.

Schedulers remain disabled, labor-rate publication remains deferred, and CRM/Interaction remains paused. This handoff starts no reconciliation, AHA evaluation, code, runtime or database work. See [Current Context](<../ai-memory/Current Context.md>) and [Open Threads](<../ai-memory/Open Threads.md>) for continuity, plus the unchanged [#14 record](<2026-09-28-gitea-14-reference-reservations.md>) and [#15 deployment record](<2026-09-29-gitea-15-template-lifecycle-deployment.md>) for their operational limits.
