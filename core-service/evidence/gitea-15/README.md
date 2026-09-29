# Gitea #15 — frozen first-pass Template lifecycle evidence

Baseline: `d721ddb6840bc58d92986cd80889edfac2c5ffee`, assessed 2026-09-29.
Local `main`, `gitea/main`, and read-only `git ls-remote gitea refs/heads/main` matched.
Original checkout: `/home/thecapt/apps/cronus`, clean `feat/crm-interactions` at
`807bc38122e771dacccbc23fca4a66363dd58d55`. Main worktree:
`/tmp/cronus-facility-query-isolation`, clean at the baseline.
Neither checkout was modified. No branch was created or switched.

Reproduction is in an isolated tracked-source archive at `/tmp/cronus-gitea-15`.
Only this evidence directory was added to the archive. No remediation, permanent
regression, commit, push, or merge has been performed. This is local, uncommitted
evidence; preserve it before temporary-directory cleanup.

## Execution and limits

Final reproduction: **33 tests: 29 passing observations/controls, 4 intentionally
failing SECURITY boundary assertions**, exit 1. All failures are assertions about
baseline behavior, not setup failures. Those four desired boundaries are proposed
policy, not a claim that policy has already been accepted.

Real Express routing/JSON parsing, JWT verification/role middleware, unchanged
Mongoose schemas and query behavior, and real ephemeral MongoDB persistence.
The baseline app mount registrations are evaluated in a VM, with database startup,
dotenv, cron, listen callback, and unrelated routers replaced by inert dependencies.
Only Template, Asset and dashboard routers are mounted as real routers. Unknown
startup dependencies fail closed. No application server entry point is launched.
Supertest uses temporary test HTTP listeners.

Existing MongoMemoryServer harness, cached MongoDB 8.2.1, runtime downloads disabled.
Configured URI is replaced by an invalid sentinel; controls prove rejection of that
URI and an alternative loopback URI. Only harness-created persistence is used and
dropped. Existing installed dependencies are reused via a symlink, with no install.
FDA responses use a synthetic Axios adapter; unexpected requests fail. No actual
FDA or Contract API calls occur. No real data, deployment, running services,
containers, schedulers, rate schedules, CRM or #9 work is involved.

**Index limitation:** the first attempt awaited Template index creation and failed
because the baseline partial index `{di: {$exists: false}}` is rejected by MongoDB
8.2.1. That setup failure is retained in `setup-attempt/`. For lifecycle reproduction
only, automatic index creation is disabled in the harness before loading models.
Application schema/source is unchanged. This does not establish deployed index
state, uniqueness behavior, concurrency correctness, or runtime MongoDB behavior.
Do not silently repair the index as part of this first pass. Node 18 tooling and
experimental VM warnings are retained in the outputs.

Reproduce from the snapshot's `core-service/` (will return exit 1):

```sh
NODE_ENV=test MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.2.1 \
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 \
node --experimental-vm-modules --experimental-specifier-resolution=node \
node_modules/jest/bin/jest.js --config evidence/gitea-15/jest.config.cjs --runInBand
```

`results.json` and `output.txt` retain the full result; `mounted-template-routes.json`
records the router's 11 mounted declarations. `baseline-source.sha256` identifies
unchanged source. `SHA256SUMS` freezes evidence. Compatibility outputs record the
unchanged #14 lifecycle and standalone regression suites: **134/134 passed across
two suites**. Their source and frozen #14 evidence were not edited.

## Exact reproduced behavior

- Admin archive `PATCH /templates/:id/achive` returns 200, including on repetition.
  Raw storage has `status: Archived` and a new `updatedAt`, but no `deletedAt`,
  `deletedBy`, `updatedBy`, or `createdBy`: none is declared by the Template schema.
- Technician gets 403 on that archive route and manual POST, but ordinary PUT
  returns 200 and persists `Archived`, `Active`, or an arbitrary status. A real
  admin archive can be reversed, even without a Facility header. Archived business
  data remains editable. Admin ordinary PUT has the same behavior.
- PUT accepts update operators: `$unset` removes status and required manufacturer.
  Validators are not enabled: negative expected lifetime and invalid benchmark
  confidence persist. `verified: true` is client-writable.
- Plain object/operator PUT strips undeclared audit fields; ordinary timestamp
  rules preserve `createdAt` and replace client `updatedAt` with current time.
  **Array pipeline PUT instead stores forged `createdBy`, `updatedBy`, `deletedBy`,
  `deletedAt` and `createdAt`, including raw strings without schema casting.**
  `updatedAt` is still overwritten by the timestamp middleware in the tested pipeline.
- Admin manual POST accepts supplied `_id`, `createdAt`, `updatedAt`, status,
  verification flag and a dangling `duplicateOf`. Undeclared actor/deletion fields
  are stripped in normal creation. No canonical creation/update actor is recorded.
- Archived rows remain in list results/count, detail, manufacturer/model distinct
  choices. The frontend Quick Add Asset picker consumes this list without an archive
  filter (caller inspection; no browser run).
- Archived Template gains new Asset links via `POST /assets` (201) and
  `PUT /assets/:id` (200). A separately seeded synthetic record carrying `deletedAt`
  also remains listed and newly referenceable. This does not assert such records
  exist in real data. Manual Template creation and PUT can newly assign archived
  `duplicateOf` references; historical duplicate population still resolves.
- Technician `POST /templates/from-di-or-udi` with an existing archived DI returns
  201 and restores `Active` via the provider mapping. Both Template-only and
  createAsset=true variants reproduce it; the latter creates a new Asset link.
- Technician `PATCH /templates/:id/sync-gudid` updates archived business data and
  verification, leaves `Archived` status, and records no actor.
- `POST /templates/from-di` returns 500 with `createAsset is not defined`, before
  a provider call or persistence. The frontend DI Template-create action calls it.
- Frontend `DELETE /templates/:id` returns 404; there is no mounted hard delete.
  Correctly spelled `PATCH /templates/:id/archive` also returns 404. Only `/achive`
  exists. Invalid archive IDs and a valid-but-missing PUT ID return 500.
- Existing archived Template references still resolve through Asset detail, batch,
  Asset lifecycle and Template lifecycle (three linked assets remain counted).
  Unrelated Asset edits with the unchanged archived reference succeed. An active,
  assigned test-equipment Asset with an archived Template remains in its picker.
  Historical validity here means retained references still resolve, not immutable
  benchmark snapshots: ordinary Template edits can still change referenced values.
- Anonymous requests return 401. Customer, viewer, literal `tech`, missing and
  unknown roles receive 403 on the role-gated routes, but all pass the two distinct
  endpoints and lifecycle endpoint (200 with valid Facility claims for lifecycle).
  Lifecycle rejects missing selection (400) and unauthorized selection (403).

## Mounted surface inventory

`A/T` below means canonical admin/technician. The allowed declaration `tech` maps
to `technician`; a literal `tech` JWT does not pass role gates. Templates are shared,
without organization/facility ownership fields. Asset references keep their existing
Facility controls. Inventory is static unless exercised above.

| Mounted route | Current boundary and consumers |
| --- | --- |
| GET `/templates` | A/T; global list/count; no lifecycle filter. TemplateListPage and CreateAssetModal via getTemplates. |
| GET `/templates/:id` | A/T; global ID lookup including archived; TemplateEditPage. |
| GET `/templates/distinct/manufacturers` | Authentication only; non-customer global distinct without lifecycle filter. Customer branch queries Asset manufacturer by `req.user.customerId`, which normalized auth does not supply; no customer-data disclosure conclusion was tested. Template list filter caller. |
| GET `/templates/distinct/models` | Authentication only; global manufacturer-filtered distinct including archived. No active frontend caller found. |
| POST `/templates` | Admin; direct body creation. Duplicate search includes archived; caller-supplied duplicateOf can persist if search finds no match. TemplateCreatePage manual flow. |
| POST `/templates/from-di-or-udi` | A/T; shared DI upsert, mapped Active; optional Asset creation after selected-Facility and reference checks. CreateAssetFromUdiModal. Separate Template mutation precedes Asset save. |
| POST `/templates/from-di` | A/T; intended DI upsert currently fails before provider. TemplateCreatePage DI flow. |
| PATCH `/templates/:id/sync-gudid` | A/T; provider field refresh without lifecycle gate; duplicate matching can include archives. TemplateEditPage sync modal. |
| PUT `/templates/:id` | A/T; unrestricted body/operator/pipeline update by ID. TemplateEditPage sends the complete fetched object, so a future allowlist needs a caller update. |
| PATCH `/templates/:id/achive` | Admin; ID-only status mutation and discarded audit fields. No matching frontend caller found. |
| GET `/templates/:id/lifecycle` | Authentication + selected authorized Facility. Template itself global; summary Facility-scoped; benchmark service intentionally includes a separate global aggregate. TemplateLifecycleSummaryCard. |
| POST `/assets` | A/T + selected Facility; validates Template existence only, then copies defaults and stores templateId. Quick Add Asset caller. |
| PUT `/assets/:id` | A/T + existing Asset visibility; accepts templateId changes, existence only. Asset editor sends populated Template as ID. Preserve unchanged historical ID on unrelated edits. |
| GET `/assets` | Authentication + tenant visibility; returns templateId and accepts templateId filter; no Template population. Asset list and Template lifecycle links. |
| GET `/assets/:id` | Authentication + tenant visibility; historical Template population (identity/description/benchmark/lifecycle defaults). Asset editor and service callers. |
| POST `/assets/batch` | Authentication + tenant visibility; read-only despite POST; same historical Template population. Contract lifecycle intelligence consumes it. |
| GET `/assets/:id/lifecycle` | Authentication + tenant visibility; historical Template population/calculation. Asset lifecycle card and Contract lifecycle intelligence. |
| GET `/assets/test-equipment` | A/T + selected Facility + assigned active Asset; Template match checks only isTestEquipment, not archive. Work-order test-equipment picker. |
| GET `/dashboard/lifecycle/replacement-forecast` | Authentication + tenant visibility; reads benchmark from historical Template population without Template archive filter. Preserve historical calculation semantics. |
| GET `/contracts/:id/lifecycle-intelligence` (contract-service) | Existing authenticated Contract boundary; indirect Template read through core Asset batch/lifecycle APIs, no Template collection write. No cross-service change proposed. |

Other relevant references: `EquipmentTemplate.duplicateOf` self-reference is written
by manual creation/update and DI duplicate detection. `Asset.duplicateOf` declares
EquipmentTemplate as its ref, although mounted Asset duplicate detection stores an
Asset ID; it is not accepted from clients and is not populated in the above routes.
Record this existing inconsistency without changing it in #15.

Work-order `POST /workorders/:id/test-equipment` links an existing Asset, not a new
Template reference; its check is same-Facility Asset existence. Historical work-order
reads populate Asset display fields, not Template. Archive effects on continued use
of existing equipment therefore require an explicit policy choice, not an assumed
extension into work-order authorization. No new work-order behavior was tested.

No mounted Template DELETE/restore route, other Template model writer, or direct
contract-service Template writer was found. Legacy scripts and scheduler consumers
are not mounted paths and were not executed or changed.

## Existing tests and proposed remediation boundary

Inspected operationalOwnership coverage for shared Templates, Asset reference IDs,
DI/UDI Facility checks and Asset audit protection; facilityQueryIsolation coverage
for Template summary/tenant benchmark selection; testEquipmentPickerSecurity
coverage for Template eligibility and Asset assignment; frontend ownership
compatibility tests. These do not provide dedicated Template archive/restore,
pipeline, audit, or new-reference lifecycle protection. Their fixtures/tests were
not changed. #14 regression execution is compatibility verification only.

Proposed scope, **not implemented**:

- Keep shared Template ownership and all Asset/Contract Facility boundaries.
- Protect status, identity, timestamps, actors, verification provenance and duplicate
  metadata with explicit validated business payloads; reject arrays/operators/dotted
  paths; server-owned lifecycle and audit; protect provider paths as well as PUT.
- Add an admin archive operation with durable actor/time, stable repeat behavior,
  and no implicit restore. Handle existing status-only archives without inventing
  historical actors/dates. Reject ordinary edits/provider refresh on archives if
  approved. Account for concurrent archive/write/reference races; a preflight check
  alone is not sufficient. Do not modify #14 reservation implementation/evidence.
- Exclude archives from new-selection data and reject new Asset/Template references;
  keep historical population, calculations and unchanged references valid. Keep
  duplicate detection's historical warning semantics distinct from new linkage.
- Align Template API/UI archive action, business payload and role/state controls;
  repair DI path inside this boundary only if approved. No hard delete, scheduler,
  benchmark redesign, service-boundary change or real-data operation.
- Later: separate permanent regressions, review, commit/push and main verification.
  Frozen reproduction must remain unchanged.

## Policy confirmation needed

1. Preserve current manual-create admin-only and active edit/DI/sync A/T roles?
   Should distinct/lifecycle reads become A/T-only, or must customer reads remain?
   Recommended: preserve mutation roles; deny noncanonical roles consistently;
   explicitly decide customer lifecycle visibility rather than infer it.
2. Recommended archive semantics: status `Archived` **or** non-null deletion marker
   means archived, covering existing status-only archives; no hard delete/restore;
   no archived edits/sync even for admins; repeat archive preserves provenance.
   Confirm treatment of other/missing legacy statuses before choosing eligibility.
3. Recommended: hide archives from new Template selection/references, preserve
   history and unchanged Asset references, and keep already-deployed test equipment
   usable. Confirm whether Template archive should instead disable that picker.
4. Recommended: provider-only `verified`, server-controlled `duplicateOf`/audit,
   canonical `/archive` with compatibility for `/achive`, frontend Archive wording,
   and correction of the broken `/from-di` path as part of #15. Confirm this boundary.

No durable engineering-memory claim or remediation is made before these decisions.
