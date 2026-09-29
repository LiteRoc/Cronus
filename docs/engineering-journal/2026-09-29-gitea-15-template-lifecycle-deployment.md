# Gitea #15 — Template lifecycle authorization deployment

Date: September 29, 2026. **Deployed successfully at `a62c96686bcaad74bba00fa64fc5fba31996b8b4`.** Startup/runtime verification passed. Authenticated #15 production smoke remains pending because no approved session/source was available.

## Controlled deployment

Gitea and GitHub main matched the approved target before deployment. The clean stable checkout `/home/thecapt/apps/cronus-main` advanced from `7c3080305aa741805b68c09c38257578bda3bc4c` only after frontend, core and contract stopped together. This was not a rolling deployment, and the bind-mounted checkout was not updated while application containers were running.

The authorized private maintenance window used three zero-active-connection samples, no HTTP requests in the preceding five minutes, and a final inactivity check before stopping. Old Node/watch processes were confirmed gone. Two read-only Mongo operational checks found zero old-backend connections and zero active operations; no business records were queried. Core, Contract and frontend then started in order. No networking changes were made.

| Service | Unchanged container ID | Previous start (UTC) | New start (UTC) |
| --- | --- | --- | --- |
| Core | `efb934aa68e7` | 2026-09-29 09:10:21 | 2026-09-29 13:22:14 |
| Contract | `86d58510ae99` | 2026-09-29 09:11:21 | 2026-09-29 13:22:33 |
| Frontend | `c2cfb3b6debe` | 2026-09-29 09:12:01 | 2026-09-29 13:22:34 |

Mongo `eb448adced26` remained continuously running since August 13, 2026, 09:58:17 UTC. All four restart counts remained zero. Both backends retained `CRON_ENABLED=false` and logged disabled schedulers. Existing Compose overrides were preserved byte-for-byte; the stable checkout remained clean.

## Verified results and limits

- Container fingerprints matched 149 core, 53 contract and 193 frontend tracked source/configuration/manifest files at the target. Both backends connected successfully to Mongo.
- Twelve unauthenticated protected-route probes returned 401, including canonical/legacy Template archive paths. The frontend shell and ten modules returned 200, including the changed Archive implementation.
- No new startup/database/index/topology error or credential marker appeared in the checked logs. Mongo structural events since core startup: zero. The known duplicate `workOrderId` schema-index warning predates this deployment. An initial readiness probe encountered a transient connection reset while core started; retry passed without restarting core.
- #14 source/startup compatibility remained intact. Database-free synthetic checks against the deployed #7 calculation module passed for captured-price preservation, quantity calculation and read immutability. These are not authenticated production lifecycle/pricing checks.
- Fresh-main verification before deployment passed 1,001 tests: 152 focused #15, 745 backend compatibility including #14/#7, 31 authentication and 73 frontend. Syntax and TypeScript with the documented baseline workaround passed. Frozen reproduction evidence was unchanged; dependency drift was absent.
- No migration, backfill, topology, dependency or configuration change was required. No images were rebuilt, dependencies installed, or recovery/repair/import scripts run. No new collection/index, transaction/replica-set, or startup/index requirement was introduced. Existing Template index declarations and unrelated Mongoose initialization behavior remain unchanged.

## Browser reload, pending smoke and rollback

**Require browser reloads before normal use resumes.** Frontend Archive now uses `PATCH /templates/:id/archive`; `/achive` remains the compatibility alias. Old tabs may retain the unsupported DELETE action or submit fields now rejected by the server. Backend authorization/archive protections remain authoritative for stale clients. Normal access was cleared to resume after reload.

**Authenticated #15 production smoke remains pending because no approved authenticated session/source was available. No authenticated production writes were performed.** No session was created and no credentials were extracted. Future smoke requires an approved existing session, Facility context where applicable, and separately authorized minimum writes/cleanup through supported application behavior. #14's authenticated first-use item also remains open; this deployment does not close it.

After #15-aware writes begin, **prefer roll-forward; blind rollback is unsafe** because old writers bypass Template lifecycle protections and reservations. Never delete lifecycle, audit or reservation metadata as rollback cleanup. Uncertain-write reservations remain non-expiring and require controlled, separately authorized recovery. The #14 recovery tool does not apply to Template reservation metadata. Any rollout or rollback must fence old writers and drain their operations.

## Handoff

The next development item is **#9 — Procedure measurement units**. This documentation-only handoff does not start #9, change code/runtime/data, enable schedulers, publish rates or resume CRM/Interaction. The deployed runtime remains at the SHA above; subsequent documentation commits are not deployments.

See [Current Context](<../ai-memory/Current Context.md>), [Open Threads](<../ai-memory/Open Threads.md>), and the [#14 reservation/recovery record](<2026-09-28-gitea-14-reference-reservations.md>) for retained operational boundaries. Frozen #15 evidence and the reviewed implementation report remain under `core-service/evidence/gitea-15/` and `verification/gitea-15/`.
