# Shared-resource ordinary-update archival investigation (S3)

Status: reproduction and policy assessment complete; **no remediation**. No issue
created or updated; no commit or push. Date: September 21, 2026.

The user names this investigation **S3**. Older stabilization notes called the
shared-resource candidate S2 and the equipment-picker candidate S3. This report
uses the current assignment's label; the equipment-picker investigation was not
started. Neither #7 nor CRM work was started.

## Checkpoints and scope

- Base main: `2f7bea84f2585eb6de14f3706c4b744b4719ab1b`.
- Dedicated branch: `fix/shared-resource-archive-auth`.
- Worktree: `/tmp/cronus-shared-resource-archive-auth`.
- Paused Interaction preserved: `e242b2044cca33a09359bc37cf2bdb1a0c7641a6`.
- Only new opt-in reproduction/configuration and this journal were added.
  Production, prior suites, manifests/lockfiles and AI Memory were not edited.

## Executive finding and classification

| Resource | Classification | Severity supported by reproduced effects |
| --- | --- | --- |
| Part | CONFIRMED BUG: technician can write/reverse admin archive fields and spoof creator/deletion identity | P1 field/lifecycle/audit protection; P0 removal/eligibility effect NOT REPRODUCED |
| Manufacturer | CONFIRMED BUG: equivalent metadata tampering and reversal | P1; Inactive business-status semantics also require policy clarification |
| Template | CONFIRMED BUG: technician can set/reverse Archived and inject audit metadata via update pipeline | P1; effective archival/read/eligibility policy requires a decision |

All three dedicated archive routes reject canonical technicians while ordinary
PUT persists equivalent lifecycle state. That is a reproduced role-boundary
inconsistency, not merely a source hypothesis. However, **both actual admin
archive and ordinary-update simulation leave records listed and usable for new
references in the tested paths**. Do not call this a confirmed P0 operational
removal/destructive bypass. Existing audit/lifecycle tampering is real P1
behavior under this task's severity rules. No resource is testability-blocked.

Status editing alone is not classified as archive bypass: for Parts and
Manufacturers a status-only edit leaves deletion metadata clear. The archive
simulation tests submit the full dedicated lifecycle tuple. Template's dedicated
route persists only status (plus the automatic updatedAt); Archived therefore
matches its persisted lifecycle effect, but has no observed eligibility effect.

## Architecture and field inventory

Current executable schemas/routes and persistence tests are authoritative here.
No accepted resource-specific archive/restore ADR or earlier regression policy
was found in the inspected material. Dedicated admin role gates are direct
policy evidence, but do not settle broader status or picker policy.

| Category | Part | Manufacturer | EquipmentTemplate |
| --- | --- | --- | --- |
| Schema | `core-service/src/models/Part.js` | `core-service/src/models/Manufacturer.js` | `core-service/src/models/EquipmentTemplate.js` |
| Ordinary business fields | partNumber, description, price, quantityOnHand, location, supplierId, manufacturerId, compatibleAssets | name, contactName, email, phone, address, website | manufacturer/model/description, equipment flags/class, PM defaults, pricing, lifecycleDefaults, benchmark fields |
| Lifecycle/status | Active/Inactive/Pending/Retired enum | Active/Inactive enum | unrestricted status string, default Active; verified and duplicateOf need explicit ownership/provenance policy |
| Archival fields | deletedAt, deletedBy | deletedAt, deletedBy | neither declared; route nevertheless attempts to write them |
| Audit/server | createdBy, updatedBy, createdAt, updatedAt, _id, __v | same | createdAt, updatedAt, _id, __v; no createdBy/updatedBy schema paths |
| Other metadata | reference IDs above | contact information above | FDA/DI/classification and record metadata, kind/subType, duplicateOf; no UDI/DI endpoint exercised or changed |
| Ownership | no Facility, tenant or Organization schema path | none | none |

The schema-absence control confirms shared-reference ownership. Parts and
Manufacturers nevertheless call the existing buildTenantFilter for lists (and
Part archive); its global-record branch includes these synthetic shared rows.
This is existing source behavior, not grounds to invent Facility ownership.
Facility context in tests only supports existing callers and owning Assets/WOs.

Actual app.js mounts are exercised using its registration code in a VM, with
real Parts, Manufacturer, Template, Asset and Work Order routers. DB startup,
cron, listen callbacks, unrelated routers and dotenv startup are disabled.
Authentication, role middleware and Mongoose persistence remain real.

### Endpoints and authoritative archive control

| Resource | Reads | Create | Ordinary update | Dedicated archive | Actual persisted archive effect |
| --- | --- | --- | --- | --- | --- |
| Part | GET /parts; no GET /parts/:id | POST /parts admin/technician | PUT /parts/:id admin/technician | PATCH /parts/:id/archive admin | deletedAt=current date, deletedBy=admin, status=Retired, automatic updatedAt |
| Manufacturer | GET /manufacturers; no detail endpoint | POST /manufacturers admin/technician | PUT /manufacturers/:id admin/technician | PATCH /manufacturers/:id/archive admin | deletedAt=current date, deletedBy=admin, status=Inactive, automatic updatedAt |
| Template | GET /templates and /:id admin/technician; distinct manufacturer/model endpoints also exist | POST /templates admin only | PUT /templates/:id admin/technician | PATCH /templates/:id/achive admin (existing spelling) | status=Archived and automatic updatedAt only; undeclared deletion/actor fields stripped |

No dedicated restore or hard-delete route is declared in these mounted routers.
Tests confirm PATCH /:id/restore and DELETE /:id return 404 without deletion.
Admin archive controls return 200 and preserve the document. Part/Manufacturer
archive does not explicitly update updatedBy. Template has no such schema path.

Template DI/UDI create/upsert/sync routes permit admin/technician in source; they
were inventoried only. Their provider calls and behavior are outside this test.
Part's customer approval endpoint is a response-only placeholder in source.

### Frontend callers and references

- `frontend/src/services/partAPI.ts` exposes list/create/PUT. Its detail and DELETE
  helpers target routes absent from the mounted Part router (runtime 404 verified).
- `useParts.ts` returns the list without lifecycle filtering; `AddPartModal.tsx`
  maps every supplied Part. Archived Parts remain in its tested API data source.
- `templateAPI.ts` exposes list/detail/PUT/manual create/distinct manufacturers.
  `TemplateEditPage.tsx` submits formData and uses DELETE for removal, whereas the
  backend's archive route is PATCH /achive. DELETE 404 is runtime verified.
- `TemplateListPage.tsx` and `CreateAssetModal.tsx` use getTemplates; the latter
  retains returned templates without an archive filter. Its picker source and
  distinct-manufacturer API still include an Archived Template.
- No direct React Manufacturer CRUD client/picker was found by the inspected
  /manufacturers search. Template/Asset manufacturer strings are separate from
  the Manufacturer collection. Do not infer a Manufacturer UI visibility effect.
- Part is referenced by WorkOrder.partsUsed.partId and Ticket.partId. Manufacturer
  is referenced by Part.manufacturerId. Template is referenced by Asset.templateId,
  Asset.duplicateOf (declared as an EquipmentTemplate ref), and Template.duplicateOf.
- Historical WorkOrder→Part, Part→Manufacturer and Asset→Template population was
  verified after both admin archive and technician simulation. New WO Part use,
  new Part→Manufacturer references and new Asset→Template references all succeed.
- Procedure references Tasks; Assets may reference a maintenance Procedure.
  No direct Part/Manufacturer/Template relationship was found in the inspected
  Procedure/Task or contract-service model searches. Contracts connect through
  operational assets/work orders; no contract-service operation was executed.

Frontend picker rendering is a **source-supported inference** from unfiltered
callers plus verified API contents; this investigation did not mount a browser.
The reference-creation and historical-population consequences above are runtime
verified through actual routes/models, not inferred from source alone.

## Ordinary update, restore and audit reproduction

Canonical technicians can submit a direct body containing:

- Part: deletedAt, arbitrary deletedBy, status=Retired.
- Manufacturer: deletedAt, arbitrary deletedBy, status=Inactive.
- Template: status=Archived. Direct undeclared audit/deletion fields are stripped.

All return 200 and persist the stated values. After a **real admin archive**,
ordinary technician PUT setting status=Active and deletion fields=null reverses
the persisted archive state for all three. There is no dedicated restore route.
Parts/Manufacturers also persist arbitrary createdBy and deletedBy identities,
including on already archived records. Audit-reference existence is not checked.
Direct updatedBy spoofing fails: the two routers overwrite it with the actor.
Direct createdAt edits are stripped; updatedAt remains server-generated. __v can
be assigned directly on all three. Template direct actor fields are undeclared.

### Role matrix (actual mounted routes and persistence)

| Caller | Ordinary business/protected-field PUT, all resources | Dedicated archive, all resources | Parts/Manufacturer list | Template list |
| --- | --- | --- | --- | --- |
| admin | 200, edits persist | 200, correct control state | 200 | 200 |
| canonical technician | 200, archive simulation/reversal persists | 403, unchanged | 200 | 200 |
| customer | 403, unchanged | 403, unchanged | 200 | 403 |
| viewer | 403, unchanged | 403, unchanged | 200 | 403 |
| legacy tech | 403, unchanged | 403, unchanged | 200 | 403 |
| missing role | 403, unchanged | 403, unchanged | 200 | 403 |
| unknown role | 403, unchanged | 403, unchanged | 200 | 403 |
| anonymous | 401, unchanged | 401, unchanged | 401 | 401 |
| invalid / expired token | 403, unchanged | 403, unchanged | 403 | 403 |

Legacy `tech` in route declarations is canonicalized by authorizeRoles to
`technician`; a token claiming `tech` does not gain mutation permission. List
behavior for valid tokens with noncanonical/missing roles is recorded as an
existing read-policy observation, not a newly invented global-read restriction.
Create controls confirm admin/technician for Part/Manufacturer and admin-only
for Template. All denied create roles receive 401/403 as appropriate.

## Body/update semantics

| Input shape | Part / Manufacturer | Template |
| --- | --- | --- |
| Direct fields | body spread passes lifecycle/audit fields; server sets updatedBy | body passed directly; declared status persists |
| $set | persists archive tuple and creator spoof; updatedBy still actor | Archived persists; unknown fields stripped in object update |
| $unset | removes status/deletion/creator fields without validation | removes status |
| Dotted scalar paths (status.bad, deletedAt.bad, deletedBy.bad) | 500, no persistence | 500, no persistence |
| Query-string $set/status | ignored by tested PUT | ignored |
| Replacement-looking object | partial update; other business fields retained | partial update, not replacement |
| Array/pipeline body | spread turns array into numeric unknown fields; only normal audit update remains | pipeline executes; status can be Archived |
| Pipeline metadata | no lifecycle/creation-time mutation reproduced | createdAt overwritten; undeclared deletedAt/deletedBy/createdBy/updatedBy persisted as raw strings, bypassing ordinary object casting/strictness |
| $rename | Part description→status succeeds and removes required description; Manufacturer unset contactName source is a no-op | description→status succeeds |

Invalid enum values persist for Part and Manufacturer because these ordinary
findByIdAndUpdate calls omit runValidators. Template has no status enum at all.
Active/Inactive/Pending/Retired/Archived status-only updates all persist on each
resource without setting deletion metadata. This is not proof every such state
should be admin-only. Template verified, duplicateOf and benchmark.notes dotted
business path also persist; their intended editing policy is unresolved.

A ninth intentionally failing security assertion preserves the Template pipeline
creation-time/undeclared-audit injection defect separately from status semantics.
No injected field is treated as new legitimate ownership. No destructive
operator was used outside synthetic ephemeral records.

## Operational consequences and severity limits

For **each resource**, tested twice (actual admin archive and technician bypass):

- Normal authenticated list still returns the record.
- Template detail and distinct-manufacturer picker source still return it.
- Part remains attachable to an existing synthetic Work Order (201).
- Manufacturer remains assignable to a newly created synthetic Part (201).
- Template remains usable by a newly created synthetic Asset (201).
- Historical references populate successfully; records are not deleted.
- Technician can reverse actual archive metadata with ordinary PUT.

Consequently, no list disappearance, picker-source removal, hard deletion, or
new-reference denial was reproduced. A true P0 removal/eligibility bypass is
**NOT REPRODUCED**, not disproved for every untested deployment/client. No real
records or deployed application were inspected. Audit integrity, enum-invalid
persistence and equivalent archive marker reversal are confirmed P1 findings.
The Part $rename probe also demonstrates required-business-field removal; this
supports rejecting update operators, not expansion into a separate repair task.

## Error and privacy observations

- Malformed Part/Manufacturer IDs: update/archive 500 with generic messages;
  missing IDs: 404. Invalid date/ObjectId audit values: generic 500, unchanged.
- Template malformed update ID: 400 with misleading "Invalid asset ID format";
  nonexistent update: generic 500 (source uses bare status(404)); archive
  malformed ID: generic 500, nonexistent ID: 404.
- Tested errors do not echo raw Mongo errors, protected records or supplied audit
  values. These inconsistencies are P2; material protected-data disclosure was
  not reproduced. Template's other list/create/provider catches contain raw-error
  source patterns, but those paths are not established privacy exploits here.
- Template PUT responds with the pre-update document; all mutation conclusions
  use persisted post-request reads, not this stale response.

## Policy decisions required before remediation

1. Define status-only business edits independently of archive: especially
   Manufacturer Inactive and Part Retired. Reserve deletion metadata for admin
   lifecycle operations without automatically banning legitimate status edits.
2. Decide what archive must do to lists, pickers and new references while keeping
   history resolvable. Today's dedicated routes do not provide exclusion.
3. Define restore availability/roles/idempotency; do not silently introduce it.
4. Decide Template's lifecycle state vocabulary and whether to add audit/deletion
   schema fields. Schema changes require explicit migration/compatibility plans.
5. Decide provenance/editing rights for verified, duplicateOf and benchmark data;
   preserve shared semantics and UDI/DI behavior.
6. Resolve mismatched frontend DELETE/detail contracts and /achive spelling in a
   separately reviewed compatibility plan, not an unannounced route rename.

## Recommended issue structure and remediation proposal (not implemented)

Recommend **two issues**, not one identical-policy fix:

1. **P1: Protect Part/Manufacturer ordinary updates from archive and audit writes.**
   Shared audit/deletion schemas and body-spread update mechanism allow a common
   scope, with separate status-policy decisions and resource regressions.
2. **P1 + policy: Define Template archive semantics and restrict ordinary updates.**
   Distinct status-only archive, missing audit schema, pipeline injection,
   pre-update responses, /achive spelling and caller mismatch need explicit scope.

Record P2 error behavior separately or as explicitly scoped follow-up acceptance
criteria. Do not raise a P0 removal claim without additional operational evidence.
No Gitea issues were created or changed.

Proposed boundary: accept only plain JSON objects; reject operator/dotted keys
and pipeline arrays at update boundaries; explicitly allow business fields;
protect _id/__v/audit/deletion metadata; derive actor/timestamps server-side;
validate values and references; preserve historical identifiers. Run validators
on allowed updates but do not rely on validators alone for authorization. For
Part/Manufacturer, prohibit archive metadata changes on ordinary routes including
already archived rows under the accepted future policy. For Template, first
accept status/restore/audit policy, then protect archive transitions consistently.
Preserve shared reference semantics and existing DI/UDI behavior. Add permanent
regressions after policy approval while retaining opt-in historical evidence.
No production, schema, API or ownership change is implemented by this report.

## Reproduction and baseline verification

New files:

- `core-service/jest.shared-resource-archive-reproduction.config.cjs`
- `core-service/src/routers/_tests_/sharedResourceArchive.reproduction.mjs`
- This journal.

Final reproduction: **237 total = 158 passing controls + 70 passing observations
+ 9 intentionally failing security assertions**. Failures: Part 3, Manufacturer
3, Template 3 (archive simulation, reversal, and each resource's audit invariant).
Part/Manufacturer archive assertions protect deletion metadata rather than
require a ban on every status-only edit. Only these security assertions fail;
the suite is deliberately opt-in and red.
Initial development run failed before routes due to a missing real-auth import
in the new VM harness; that test wiring was corrected before evidence collection.
No production conclusion relies on the failed setup.

Baselines, unchanged from main, all pass:

| Baseline | Count |
| --- | --- |
| Supplier #13 | 59/59 |
| Facility #3 | 45/45 (29 + 16) |
| Vendor #4 | 90/90 |
| WO subresources #5 | 295/295 |
| Ownership #6 | 215/215 (214 + standalone 1) |
| Complete safe core | 870/870, 12 suites |
| Authentication | 31/31 |

Core includes the component counts above plus Contact 56, FollowUp 107 and
lifecycle 3. It excludes this opt-in evidence and paused Interaction's 54 cases.
Authentication is a separate contract-service-hosted suite against isolated core
and contract test databases. No previous suite was modified. New-file syntax and whitespace checks passed;
all previously tracked source and documentation remain byte-for-byte unchanged.

Reproduce from core-service with existing dependencies and cached binary:

```sh
NODE_ENV=test MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 \
MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false \
node --experimental-vm-modules --experimental-specifier-resolution=node \
node_modules/jest/bin/jest.js --config jest.shared-resource-archive-reproduction.config.cjs \
--runInBand
```

Expected exit: nonzero, nine security failures. Filter `--testNamePattern='^(CONTROL|OBSERVATION):'`
for green controls/observations or `--testNamePattern='^SECURITY:'` for the nine
preserved boundary assertions. Do not rewrite the security expectations to make
this pre-remediation evidence green. Optional S3_OBSERVATIONS_FILE writes only
synthetic observations; no operational dataset is used.

The existing fail-closed harness rejects configured/arbitrary Mongo URIs and
uses an existing MongoMemoryServer binary with downloads disabled. External
Axios transport is denied in this reproduction; no provider endpoint is called.
All fixtures are synthetic, including users and Facilities. Startup jobs/listen
callbacks are disabled. Temporary dependency links reuse existing packages; no
installation or dependency change occurred and links are removed at handoff.
No containers, real databases, external services or scheduled jobs were touched.
No live deployment, browser integration, provider API or real-data verification
was performed. Existing Node/Jest and duplicate-index warnings remain unchanged.


## Accepted lifecycle policy and deferment — September 21, 2026

The user accepted this reproduction and its severity assessment. The 237 cases
(228 passing controls/observations, nine intentional security failures) are
preserved without modification. All earlier observations and policy ambiguities
remain historical evidence of what was known at reproduction time; the decisions
below supersede those ambiguities prospectively, not the reproduced behavior.

S3 did not reproduce a P0 operational archive/removal effect. Confirmed defects
are P1 security/lifecycle integrity backlog work, deferred until the P0 gate is
cleared. S3 no longer blocks that gate. Using the current assignment's labels,
S2 — test-equipment picker Facility authorization — is the final known P0
candidate from the post-#6 sweep. #7 remains paused until S2 is reproduced and
the P0 gate is rerun. No S2 investigation or S3 remediation is authorized here.

### Parts and Manufacturers: accepted future policy

- Remain shared-reference entities; do not introduce Facility ownership.
- Archive is admin-only and sets server-controlled lifecycle/audit state.
- Archived records are excluded from normal active lists and pickers and cannot
  be selected for new references. Existing historical references remain valid
  and resolvable. No restore workflow in this stabilization slice.
- Admin and technician ordinary updates may edit only explicitly approved
  business fields. They cannot set/change deletedAt, deletedBy, createdAt,
  createdBy, archive audit fields or other server-owned lifecycle/audit metadata.
- Ordinary updates must eventually enforce schema enum/validation rules and
  reject operator/pipeline bodies. Legitimate business-status editing remains
  distinct from archival; this policy does not ban every status-only edit.

### Templates: accepted future policy

- Remain shared reference/catalog data; do not introduce Facility ownership.
- Archived lifecycle is admin-controlled. Ordinary business updates by either
  technician or admin cannot directly create or reverse that lifecycle.
- Archived Templates are excluded from normal active lists/pickers and cannot
  be used for new Assets. Existing Assets retain historical Template references.
- No restore workflow in this stabilization slice. Archive audit must be explicit
  and server-controlled rather than undeclared metadata.
- UDI/DI must not silently reactivate or reuse an archived Template. An otherwise
  matching archived Template must cause safe failure/conflict pending an explicit
  future restore/reactivation policy.
- Ordinary updates must eventually use an explicit business-field allowlist,
  reject update operators/pipelines, preserve server timestamps, prevent
  createdAt overwrite and prevent archive/lifecycle/audit spoofing.

These are accepted requirements, **not implemented behavior**. Exact business
allowlists and any necessary Template schema/migration/API compatibility details
remain future implementation decisions within this policy. Original Part,
Manufacturer and Template findings, admin controls, technician simulation and
reversal, audit/operator/pipeline observations, and P2 error observations remain
unchanged above. The nine failing security assertions are not rewritten.

Publication is authorized as `test: reproduce shared-resource lifecycle authorization defects`
on fix/shared-resource-archive-auth, followed by two open P1 Gitea backlog issues:
Part/Manufacturer lifecycle protection and Template lifecycle authorization.
Git and subsequent tracking records provide the evidence commit and issue IDs.
No production remediation, restore workflow, S2, #7 or CRM work is included.


## Evidence publication and P1 backlog tracking — September 21, 2026

Evidence/policy commit `84d58ee4927ff4a23dbfd6c5add1b43ef404f49f`
(`test: reproduce shared-resource lifecycle authorization defects`) contains
only the reproduction, opt-in configuration and journal. Both Gitea/GitHub
pushes succeeded and both live evidence refs were verified equal to that commit.
SHA-256 comparisons confirmed the entire suite and configuration were unchanged
from the accepted reproduction, including all nine security assertions. Syntax,
staged/unstaged whitespace and git diff --check passed. Tests were not rerun for
this append-only policy/publication task; the preserved run remains 237 total,
228 passing, nine intentional failures, with the earlier green baselines above.

Created open P1 backlog issues:

- [Gitea #14 — security: Protect Part and Manufacturer lifecycle fields](http://192.168.1.185:3000/LiteRoc/cronus/issues/14).
- [Gitea #15 — security: Enforce Template lifecycle authorization](http://192.168.1.185:3000/LiteRoc/cronus/issues/15).

Each issue carries the P1 label, evidence commit, reproduced findings, accepted
lifecycle requirements, future acceptance criteria and isolated synthetic
regression requirement. Neither issue is closed or under remediation.
Current Context/Open Threads now record S3 as reproduced and removed from P0
blockers, with S2 the final known candidate and #7 paused pending S2 reproduction
and a P0 gate rerun. They also correct inherited stale Supplier #13/Interaction
handoff status using the already verified publication/closure checkpoint.

This follow-up documentation commit records the issue IDs and current handoff;
Git identifies its hash. No merge to main or Interaction occurred. No production
code, tests, dependencies, real databases, containers or runtime jobs changed.
Only the authorized Git publication and Gitea label/issue creation mutated
external systems. S2, #7, S3 remediation and CRM work were not started.
