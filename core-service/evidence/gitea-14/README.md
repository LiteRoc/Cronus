# Gitea #14 — frozen first-pass evidence

Baseline: `a8aea6fbe593840b4cbccead0a6565ccc2d9ede0` (2026-09-28 investigation).
Branch: `repro/gitea-14-part-manufacturer`; worktree: `/tmp/cronus-gitea-14`.
Remote `git ls-remote gitea refs/heads/main` and local `main`/`gitea/main` matched this SHA.
Original `/home/thecapt/apps/cronus` was clean on `feat/crm-interactions` at `807bc38122e771dacccbc23fca4a66363dd58d55`; left untouched.

Frozen reproduction, not a permanent regression suite. Do not adapt its observations to a future fix. Add separate permanent regressions during remediation. No production files changed; no commit or push in this pass.

## Execution and isolation

25 tests: **19 passed, 6 intentionally failed**; exit 1. Every failure is a named SECURITY assertion, not a setup failure. See `output.txt` and `results.json`.

Real Mongoose schemas, real MongoDB persistence, Express JSON parsing, JWT verification, role gates and Part/Manufacturer/work-order routers. App mount registrations are evaluated from baseline `app.js` in a VM; startup DB, cron, dotenv, listen callback and unrelated routes are disabled with fail-closed dependency handling. Supertest binds temporary test HTTP listeners. Only synthetic records are used.

The existing `mongoMemoryHarness.mjs` creates an ephemeral loopback MongoDB instance with a cached 8.2.1 binary. Downloads are disabled. Configured URI is replaced by an invalid sentinel; explicit tests prove that both the sentinel and an alternate loopback database are rejected. Cleanup drops only the ephemeral database and stops that process. No deployed/runtime application, real database, scheduler, external service, rate schedule, or frozen #7 evidence is accessed or changed. Existing dependencies are reused through a temporary symlink, removed after execution. Node 18 emits the existing memory-server minimum-version and experimental-VM warnings; execution nevertheless completed all tests.

Reproduce from this worktree after linking an existing compatible core-service `node_modules` (no dependency install needed here):

```sh
MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.2.1 MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 NODE_ENV=test node --experimental-vm-modules core-service/node_modules/jest/bin/jest.js --config core-service/evidence/gitea-14/jest.config.cjs --runInBand
```

`SHA256SUMS` freezes the evidence files. `baseline-source.sha256` identifies the source/harness/config used. Results describe this source-level isolated application, not deployed behavior.

## Reproduced behavior

For **both Part and Manufacturer**, canonical `technician` JWTs:

- Receive 403 from PATCH archive; admin archive succeeds with 200.
- Receive 200 from ordinary PUT with forged `deletedAt`, `deletedBy`, `createdBy`, and archive status; forged values persist. Plain `updatedBy` is overridden with the actual actor.
- After a real admin archive, receive 200 from PUT `{deletedAt:null, deletedBy:null, status:"Active"}`; all three values persist, reversing the archive.
- Receive 200 from PUT with `$unset` for deletion metadata/creator and `$set` for Active; raw persisted fields are removed.
- Receive 201 on POST with supplied identity, archive metadata, updater and timestamps. Those values persist; `createdBy` alone is overwritten with the actor.
- Can edit already archived rows and persist an undeclared status using PUT (query validators are not enabled).
- See archived rows in normal GET lists, as do admins and customers with valid facility context.
- Receive 500 listing shared records without a facility context.

Anonymous lists return 401. Customer/viewer/literal `tech`/unknown roles cannot create or update (403); middleware maps allowed `tech` declarations to canonical `technician`, not literal JWT `tech`.

New references also bypass lifecycle checks:

- POST Part creates a new link to an archived Manufacturer (201).
- PUT a previously unrelated Part assigns an archived Manufacturer (200).
- POST `/workorders/:id/parts` adds an archived Part to a synthetic authorized work order (201); persistence contains the new usage.
- Existing Part→Manufacturer population and GET work-order parts population still resolve archived records. This is desired historical behavior.

The identical mass-assignment defect affects both entities. Differences: Part archives to `Retired` through a tenant-filtered query; Manufacturer archives to `Inactive` by ID. Neither schema declares facility ownership, consistent with shared-reference policy.

## Mounted surface inventory (static source unless reproduced above)

| Path | Access/current behavior | Caller/reference implications |
| --- | --- | --- |
| GET `/parts` | Authenticated; tenant filter, optional valid `assetId` compatibleAssets filter; no archive filter | `partAPI.getParts` → `useParts` → `AddPartModal` picker. All returned rows offered. |
| POST `/parts` | Admin/technician; spreads body; checks supplier ID syntax only | Creates Manufacturer reference without existence/archive validation. `partAPI.createPart`/hook. |
| PUT `/parts/:id` | Admin/technician; unfiltered ID update, body spread, no query validators | Replaces Manufacturer reference; `partAPI.updatePart`/hook. |
| PATCH `/parts/:id/archive` | Admin; ID + tenant filter; stamps deletedAt/deletedBy/Retired | No archive UI caller found. No active-only predicate; repeated archive can overwrite original metadata. Does not stamp updatedBy. |
| POST `/parts/:id/approve` | Customer; response-only placeholder | No persistence or actual reference creation. |
| GET `/manufacturers` | Authenticated; tenant filter; no archive filter | Catalog list/picker API; no frontend catalog caller found. |
| POST `/manufacturers` | Admin/technician; body spread | Creates shared reference entity. |
| PUT `/manufacturers/:id` | Admin/technician; unfiltered ID update, body spread, no query validators | Same protected-field bypass as Part. |
| PATCH `/manufacturers/:id/archive` | Admin; ID only; stamps deletedAt/deletedBy/Inactive | Repeated archive can overwrite original metadata; does not stamp updatedBy. |
| POST `/workorders/:id/parts` | Admin/technician + parent ownership | Sole mounted new Part-usage path; `workOrderCosts/mutate.part` loads catalog by ID with no archive check. Frontend `workOrderAPI.addPartToWorkOrder`. |
| GET `/workorders/:id/parts` | Admin/technician + parent ownership | Historical Part and nested Supplier/Manufacturer population. |
| PUT/DELETE `/workorders/:id/parts/:partId` and `/workorders/:id/part-usages/:usageId` | Admin/technician + parent ownership | Existing usage quantity/note edits or removal; cannot reassign partId. Preserve captured costs/historical behavior. |
| GET `/workorders/:id` | Admin/technician + parent ownership | Populates historical Parts. |
| GET `/workorders`, `/workorders/by-contract/:contractId` | Existing work-order authorization/scoping | Historical partsUsed data returned; no new catalog references. |
| GET `/dashboard` | Authenticated + tenant filter | Low-stock Part count lacks archive filtering (static finding; dashboard not executed). |
| GET `/assets/distinct/manufacturers`, `/templates/distinct/manufacturers` | Existing authenticated asset/template scopes | Distinct free-text manufacturer values, NOT Manufacturer entity IDs. Asset/template filters call these; outside entity lifecycle remediation. |

No mounted Part/Manufacturer GET-by-ID, DELETE, or restore routes. Frontend `getPartById` and `deletePart` helpers point to absent GET/DELETE routes; record this compatibility mismatch without inventing new endpoints. `/assets/:assetId/workorders` is a listing handler, not a mounted alternate work-order mutation router. Work-order ordinary create/update protect `partsUsed`; ticket promotion does not create Part usages. `Tickets.partId` exists in schema but `ticketRouter` is unmounted. Imports/seed/repair scripts are not mounted reference paths and were not executed. No contract-service Part/Manufacturer entity writer found.

Existing permanent workOrderSubresourceSecurity tests check shared Part ownership and usage authorization; workOrderCosts tests cover snapshots and usage mutations. No dedicated mounted Part/Manufacturer lifecycle protection tests found. Existing tests were inspected, not modified or broadly run.

## Proposed remediation boundary — not implemented

- Keep both models shared. Localize shared-list/archive query corrections; do not redesign global tenant middleware.
- Explicit create/update business-field allowlists and reject protected/audit fields plus operator/dotted-key input. Server owns identity, creation/update provenance and lifecycle metadata. Validate updates.
- Keep admin-only archive, protect ordinary writes to archived records, preserve archive provenance on repeat requests, and expose no restore path.
- Exclude archived rows from catalog lists/pickers and the Part low-stock count. Do not filter historical population.
- Validate new Manufacturer references on Part create/reference change and active Part availability on work-order attachment. Preserve unchanged historical references on unrelated edits and existing usage/snapshot behavior. Only the active-reference guard belongs in the work-order cost mutation function; no #7 financial redesign or labor-rate changes.
- Add separate permanent lifecycle/authorization/reference regressions, then review before commit/push/main verification in a later authorized phase.

## Policy decisions still needed before remediation

Accepted policy from the task is retained: shared entities; admin-only archive; exclude archives from normal lists/pickers/new references; historical references valid; business allowlists; server-controlled lifecycle/audit; no restore.

1. Is archive defined solely by `deletedAt`, or also by legacy status (`Part.Retired` / `Manufacturer.Inactive`)? May ordinary business updates change status among non-archive values? Both schemas have non-active statuses independent of deletion metadata. Recommended: use deletion metadata as the archive boundary; explicitly decide whether Retired is also reserved and whether Inactive/Pending Parts remain selectable.
2. Should ordinary business-field edits of archived catalog rows be rejected even for admins? Recommended: reject; keep historical usage edits governed by their existing rules.

Repeat archive response semantics (idempotent unchanged success recommended) and rejection status codes can be implementation choices unless a specific API contract is required. Current create/update role policy can remain admin/technician; the accepted policy only changes archive authorization.
