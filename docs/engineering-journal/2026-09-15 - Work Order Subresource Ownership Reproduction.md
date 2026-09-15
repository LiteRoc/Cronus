# Work Order Subresource Ownership Reproduction — Gitea #5

## Status and evidence boundary — 2026-09-15

**Reproduction and authorization-boundary assessment only. No production remediation.**

- Tested base: `a7ad89724722b999bb0b201ae894142eae82c8ea`, current main at task start.
- Evidence branch: `fix/workorder-subresource-ownership`.
- Worktree: `/tmp/cronus-workorder-subresource-ownership`.
- Paused Interaction checkpoint preserved: `2c8776975c54f13bfeb580b9c96cd9fb3f4c4fa4`.
- Runtime evidence uses synthetic, isolated persistence and minimal Express applications. It does **not** establish production exploitation or deployed-runtime behavior.
- No real database, application startup, Docker, scheduled jobs, external service calls, dependencies, Contract/Vendor/CRM behavior, or Gitea issue state was changed.

Results: **343 cases: 323 passing controls/observations/matrix checks; 20 intentionally failing security assertions; zero skipped.** The passing cases include assertions recording unsafe existing behavior; they are not 323 assertions of security. All failures are explicitly named `SECURITY:`. No assertion was weakened to make the suite green.

## Harness and safety

The opt-in configuration is `core-service/jest.workorder-subresource-reproduction.config.cjs`; evidence is `core-service/src/routers/_tests_/workOrderSubresourceOwnership.reproduction.mjs`. The configuration inherits the existing core test transform and substitutes only `testMatch`. Normal core tests do not include this evidence suite.

The harness uses the existing `createIsolatedMongoHarness`: a forbidden configured-URI sentinel, a guard accepting only the URI issued by MongoMemoryServer, loopback validation, and ephemeral teardown. An executed control rejects both the configured sentinel and an unrelated loopback MongoDB target. Binary downloads are disabled; the already available local MongoDB binary is used. No `.env` or service startup is imported.

Fixtures contain Facilities A/B, distinct organization identifiers, Users A/B, Assets A/B, Work Orders A/B and distinguishable labor, travel, parts, equipment and measurements. Parts, Procedures and Tasks use their actual schemas; an explicitly labeled legacy-Part observation alone injects a raw extra Facility field. Signed synthetic JWTs exercise actual authentication and role middleware. Anonymous and invalid-token requests are also exercised.

The minimal app mounts actual Asset, Work Order and Part routers. Asset router import precedes Work Order router, matching `app.js`: Asset router sets Mongoose `strictPopulate=false` in the real import graph. This reproduces current mounting behavior rather than changing test-only population rules. Production application startup, database configuration and cron are not imported. Creation routes that could call contract-service are not invoked.

## Active endpoint inventory

All routes below are relative to **`/workorders`**, mounted by `core-service/app.js:84`. Every listed route uses `authenticateToken` (**A**). **R** means `authorizeRoles('admin','tech')`: this declaration permits canonical `technician`, but a token carrying legacy `tech` is denied. **O** means `ensureTenantOwnsWorkOrder`, which checks `_id` plus `buildTenantFilter(req)` and returns 404 for an invisible parent. **S** means the handler repeats the tenant predicate in its update query.

Source: `core-service/src/routers/workOrderRouter.js` at the indicated starting lines. Classifications apply to the tested behavior; they are not blanket certification of every possible input.

| Method / route | Line | Guards | Parent lookup / mutation; child checks | Classification |
|---|---:|---|---|---|
| GET `/:id` | 138 | A,O | Guard scoped `findOne`; handler `findById` and population; supplies nested records | NOT REPRODUCED: foreign-parent read denied; role policy discussed below |
| POST `/:id/time-logs` | 439 | A,R,O | S `findOneAndUpdate`, `$push`; positive time; server actor/time | NOT REPRODUCED: parent/role/actor bypass |
| DELETE `/:id/time-logs/:logId` | 457 | A,R,O | Helper `findById`, filter embedded ID, `findByIdAndUpdate`; missing child 404 | NOT REPRODUCED: parent/role bypass |
| POST `/:id/travel-logs` | 466 | A,R,O | S query `$push`; positive time; server actor/time | NOT REPRODUCED: parent/role/actor bypass |
| DELETE `/:id/travel-logs/:logId` | 484 | A,R,O | Same deletion helper and membership check | NOT REPRODUCED: parent/role bypass |
| PATCH `/:id/procedure` | 493 | A,R,O | Procedure `findById` and populated Tasks; S `$addToSet` snapshot | NOT REPRODUCED: parent bypass; POLICY DECISION REQUIRED: reference visibility |
| PATCH `/:id/procedure/:procedureId/task-results` | 538 | A,R,O | S query matches embedded Procedure, replaces result array; separate TaskResult upserts | NOT REPRODUCED: parent bypass; CONFIRMED BUG: P2 raw errors; reference-integrity observations below |
| DELETE `/:id/procedure/:procedureId` | 609 | A,R,O | Validates Procedure ID; S membership match and `$pull` | NOT REPRODUCED: parent/role bypass |
| GET `/:id/parts` | 650 | A | Unscoped `findById`, populates Part and supplier/manufacturer details | CONFIRMED BUG: P0 foreign-parent disclosure |
| POST `/:id/parts` | 675 | A,R | Unscoped parent and Part `findById`; push usage, `save` | CONFIRMED BUG: P0 foreign-parent mutation |
| PUT `/:id/parts/:partId` | 712 | A,R | Unscoped parent; first matching Part reference; edit quantity/note, `save` | CONFIRMED BUG: P0 foreign-parent mutation |
| DELETE `/:id/parts/:partId` | 742 | A,R | Unscoped parent; remove matching Part references, `save` | CONFIRMED BUG: P0 foreign-parent mutation |
| POST `/:id/test-equipment` | 766 | A | Unscoped parent; no Asset lookup/visibility check; push, `save`, populate and return full WO | CONFIRMED BUG: P0 parent mutation/disclosure; P1 role/reference bypass |
| DELETE `/:id/test-equipment/:equipmentId` | 797 | A | Unscoped parent; filter equipment references, `save`; absent child still 200 | CONFIRMED BUG: P0 parent mutation; P1 role bypass |
| PATCH `/:id/assign` | 384 | A,R,O | S query; assignedTo ObjectId syntax only | NOT REPRODUCED: parent/role bypass; assignee eligibility not established |
| PATCH `/:id/status` | 402 | A,R,O | S query; nonempty status, server completion timestamp | NOT REPRODUCED: parent/role bypass |
| PATCH `/:id/schedule` | 423 | A,R,O | S query updates scheduling dates | NOT REPRODUCED: parent/role bypass |
| PATCH `/:id/archive` | 594 | A,admin,O | S query sets status and server archive actor/time | NOT REPRODUCED: parent/role bypass |
| PUT `/:id` | 366 | A,R,O | S update with `req.body`, `runValidators:true`; server top-level updatedBy | CONFIRMED BUG: P1 nested audit/reference bypass; parent boundary itself held |

There are no dedicated GET labor/travel/equipment/procedure/results routes, no dedicated PATCH labor/travel/equipment edit routes, and no nested attachment/comment/note handlers. Reads use WO detail; replacement of arrays is possible through whole-WO PUT. Frontend `workOrderAPI.ts` declares time/travel PATCH edit helpers, but those endpoints return 404. This is a workflow observation, not evidence of an authorization bypass.

Other mounted Work Order routes are GET `/` (list), GET `/by-contract/:contractId` (scoped contract summary), POST `/`, POST `/request` (deprecated), and POST `/from-ticket/:ticketId`. These are not subresources of an existing parent WO and were not expanded into new issue work. Existing #3 regression coverage runs against list/search. No standalone mounted TaskResult read API was identified in this surface.

The Asset router's `use('/:assetId/workorders', ...)` is a scoped list handler, not delegation into the Work Order mutation router. A synthetic POST with an extra nested mutation suffix returns the authorized Asset's list and leaves the foreign WO unchanged; a foreign Asset prefix returns 404. Broad method/path acceptance is an observation, not a reproduced mutation bypass.

## Authentication, role and Facility matrix

The evidence executes all 19 inventory operations for each listed role/context, plus Facility-B technician own-parent controls, malformed/nonexistent parent IDs, and admin selected-A/parent-B requests.

| Request context | Scoped detail | R-gated mutations | Admin archive | Parts read | Parts mutations | Equipment add/remove |
|---|---:|---:|---:|---:|---:|---:|
| Admin selected A, parent A | 200 | success | 200 | 200 | success | 200 |
| Technician A, parent A | 200 | success | 403 | 200 | success | 200 |
| Technician B, parent B | 200 | success | 403 | 200 | success | 200 |
| Technician A, parent B | 404 | 404 | 403 | **200** | **success** | **200** |
| Admin selected A, parent B | 404 | 404 | 404 | **200** | **success** | **200** |
| Customer/viewer/legacy tech/missing/unknown role, authorized Facility A | 200 | 403 | 403 | 200 | 403 | **200** |
| Anonymous | 401 | 401 | 401 | 401 | 401 | 401 |
| Invalid token | 403 | 403 | 403 | 403 | 403 | 403 |

Success is 200 except parts creation, which returns 201. Rejected mutation cases assert unchanged parent persistence. Signed unknown/missing roles pass authentication because role validation occurs in separate middleware; no role gate exists on equipment handlers.

**NOT REPRODUCED:** anonymous/invalid-token access and mutation across this inventory. Authentication is present. **CONFIRMED BUG P1:** equipment mutation bypasses the established admin/canonical-technician Work Order mutation boundary. **POLICY DECISION REQUIRED:** whether customer/viewer/legacy/missing/unknown role detail reads should be permitted at all. Current collection listing denies these roles while detail allows same-Facility reads. This inconsistency is recorded without inventing a new approved read policy.

The generic/global-record branch of `buildTenantFilter` is an existing policy, not changed here. Selected-Facility admin behavior is reported separately from global admin privileges. No concurrent ownership-change race was exercised. Protected middleware is async Express 4 code without its own catch; malformed/missing/unauthorized selected-Facility contexts that can throw inside the helper were not forced through that middleware in-process. **TESTABILITY BLOCKED for that additional error-path assessment in this harness:** safely investigate it with a controlled subprocess before claiming coverage; do not add a test-only error wrapper that changes mounted behavior. Valid A/B selections were exercised throughout.

## Confirmed security findings

### F1 — P0: parts handlers omit parent Facility authorization

All four parts endpoints retrieve the parent with `WorkOrder.findById(req.params.id)` without O or an equivalent tenant predicate. A Facility-A technician reads B's usage notes, Part identifiers/details and quantities, then can add, update or remove B usage. Mutation effects are checked in isolated persistence. The read route also has no role gate. This is a known-parent-ID attack; enumeration is not necessary to reproduce it. Counts/pagination are not exposed separately; array length and content are disclosed.

### F2 — P0 parent mutation/disclosure and P1 role bypass: equipment handlers

Both equipment endpoints use unscoped parent `findById` and authentication alone. A technician associated only with A can add/remove equipment on B. Customer, viewer, legacy tech and signed missing/unknown roles can mutate their selected Facility's WO too. The add response returns the full foreign WO, including description, labor narrative, travel notes and procedure measurements, not merely the new equipment entry. Therefore protected direct detail/labor/result reads can be bypassed through this mutation response. No anonymous bypass was reproduced.

### F3 — P1: inaccessible Asset references bypass Asset visibility

Equipment POST accepts `equipmentId` without checking Asset existence, Facility visibility or type. A's GET `/assets/B` returns 404, but attaching that same B Asset to A's WO succeeds and returns B's model/manufacturer/identifier. Whole-WO PUT permits the same reference and subsequent GET detail populates its foreign metadata. This is a reference-authorization defect even when parent WO ownership is correct. A nonexistent valid ObjectId is stored as a dangling reference; malformed equipment ID returns generic 500. Whether equipment must be a TestEquipment discriminator, calibrated, or approved for cross-Facility loan is an additional human policy question, not a justification for silently exposing inaccessible Assets.

### F4 — P1: whole-WO update bypasses nested audit controls

PUT `/:id` destructures `timeLogs`/`travelLogs` away into `rest`, but the actual update still uses **`req.body`**. A technician replaces labor entries with another user's ID and a historical client timestamp. Travel, equipment and result actor snapshots are likewise accepted through whole-WO replacement. Schema validation checks shape, not actor authority or referenced-resource visibility. Top-level `updatedBy` is server-stamped; that does not authenticate embedded actors.

Dedicated labor/travel/parts/equipment additions and parts updates correctly ignore attempted actor/time spoofing. Dedicated task submission stamps `submittedBy`/`submittedAt` and overrides supplied foreign workOrder/procedure IDs for the standalone result. These passing controls establish the inconsistent bypass through general PUT. Any legitimate admin correction or entering labor on another person's behalf needs an explicit policy, not unrestricted technician replacement.

### F5 — P2: malformed result IDs disclose internals

PATCH `/:id/procedure/:procedureId/task-results` returns `{error: err.message, stack: err.stack}` at line 589. Malformed Procedure or Task IDs produce 500 with Mongoose cast details and router stack paths. An authenticated authorized technician can reproduce this on their own WO. Other unscoped handlers return generic 500 for malformed parent IDs; this is stable but inappropriate input-error classification, not a demonstrated raw-detail leak on those paths.

The 20 intentionally red cases consist of six parent guards, ten equipment-role guards, two foreign equipment-reference guards (POST and general PUT), one labor-actor guard, and one stack-redaction guard. Multiple failing assertions represent facets of the same underlying defects; they are not 20 independent vulnerabilities.

## Child references, errors and query behavior

- All nonexistent parent IDs return 404. Protected malformed-parent paths return 400; the six unscoped handlers return 500. Foreign protected parent requests return 404, with archive returning 403 first for a technician. Assertions permit either 403 or 404 for remediation; a stricter nondisclosure status policy is not invented.
- Labor/travel child deletion returns 404 for malformed, nonexistent or B-only child IDs under A. Procedure deletion validates syntax (400) and otherwise returns 404 for absent membership. Parts update/delete use the referenced Part ID, return 404 for unknown/foreign-child IDs, and do not search another WO. Equipment deletion returns 200 for malformed, absent and foreign-only equipment IDs under A; it does not delete B's parent in these own-parent tests.
- Part and Procedure attach validate ID syntax (400) and existence (404), but no ownership predicate is applied to these reference lookups. Their schemas have no `facilityId`; Procedure/Task sharing and Part ownership remain **POLICY DECISION REQUIRED**. A/B names on those synthetic records are labels, not invented ownership.
- In a separately labeled synthetic legacy case, a raw `facilityId:B` Part is hidden by GET `/parts` in A yet accepted by A's WO and exposed by its parts read. This proves conditional predicate inconsistency, not the existence or intended semantics of real legacy records. Do not impose new Part tenancy based on this test.
- Result submission accepts a well-formed nonexistent Task ID and a real Task outside the attached Procedure. **Confirmed reference-integrity observation (P2 workflow)**; no Task Facility schema establishes a cross-Facility claim. Determine accepted Procedure membership/version rules before remediation. Standalone result identity is keyed by WO plus Task, while Procedure is updated separately; no cross-WO redirect succeeded in the controlled body-spoof test.
- No subresource search, count or pagination implementation was found. `q`, `search`, `facilityId`, `page`, `limit` are ignored by parts read; they neither restore scope nor cause a separate overwrite defect. Parent detail keeps its scope under query variations. **NOT REPRODUCED:** search replacing an existing subresource authorization predicate. Parts disclosure exists without search.
- Assignment validates ObjectId syntax, without an assignee eligibility lookup. Cross-Facility assignee policy was not established or separately reproduced as unauthorized. Report it as an unresolved boundary, not a confirmed vulnerability.

## Mutation-integrity observations outside remediation scope

- **#7 cost correctness:** query-based labor deletion removes the log but leaves the synthetic prior labor cost and calculation timestamp intact. Labor/travel/procedure/general query updates bypass WorkOrder `pre('save')`; parts/equipment document saves invoke it. No cost fix or #7 issue action was performed.
- **#9 procedure units:** attachment requests `unitOfMeasure`, whereas Task schema stores `unit`; synthetic `V` becomes null in the attached snapshot. No units fix or #9 issue action was performed.
- Parts/equipment child actor fields are populated, but their handlers do not explicitly set the WO's top-level `updatedBy`. General PUT can replace embedded histories. Result array update and standalone upserts are separate operations; transactional/partial-write behavior was not tested. These are integrity/audit considerations, not a reason to expand this task into a refactor.
- Deletion helpers use an unscoped second lookup/update after a scoped authorization precheck. Tested sequential requests were protected. A time-of-check/time-of-use ownership race is a source concern only; it was not reproduced.

## Minimal remediation options — proposals only

1. Apply the existing parent Facility visibility boundary to every parts/equipment read and write, consistently with selected-Facility behavior. Prefer a shared authorized-parent lookup and scoped mutation predicates; preserve existing generic/global policy. Decide 404 versus 403 consistently. Do not rely on the list route's middleware.
2. Apply canonical admin/technician mutation authorization to equipment routes. Obtain an explicit decision for subresource/detail read roles; fail closed for unsupported roles under that decision.
3. Resolve equipment Assets through the approved Asset visibility predicate before attachment or population. Prevent both dedicated and general-update bypasses. Define equipment type/loan policy separately rather than inventing broad access.
4. Allowlist whole-WO updates and remove client authority over embedded actors/audit history. Route nested changes through authorized handlers or validate them equivalently. Retain a deliberate audited admin correction path only if approved.
5. Validate parent/child/reference IDs and return stable 400-class errors for malformed inputs, generic 500 for unexpected errors, and no stack/internal details. Validate Task existence/membership once Procedure/version rules are settled.
6. Keep #7 cost recomputation and #9 unit mapping in their assigned work. Scope fixes must not accidentally change financial or procedure semantics.

### Human decisions required before remediation

- Approved read-role matrix for WO detail and every subresource; current detail/list policies differ.
- Whether Parts, Procedures and Tasks are shared/global or scoped, including legacy extra Facility fields and historical references.
- Equipment Asset visibility, inter-Facility loan exceptions (if any), and discriminator/calibration requirements.
- Whether technicians can edit/remove other technicians' entries or submit on their behalf; define audit provenance and admin corrections.
- Procedure membership/version expectations for results and behavior for archived/completed WOs.
- Error nondisclosure convention (403 or 404). The reproduction accepts either for foreign-parent denial.

These decisions do not negate the confirmed cross-Facility parent and equipment disclosure defects. Production remediation has not been authorized or implemented in this checkpoint.

## Verification and rerun instructions

Run from `core-service`, with existing dependencies available and the inspected cached binary:

```sh
MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false npm test -- --config jest.workorder-subresource-reproduction.config.cjs --runInBand --silent
```

Expected at this base: **exit 1**, 323 passing and 20 intentionally failing. `OBSERVATION`, `MATRIX` and `ERROR` cases document current behavior, including unsafe success; interpret them separately from `SECURITY` invariants. Do not change production or weaken the red assertions to make this historical evidence green. Future policy changes may intentionally invalidate observational expectations and should be documented explicitly.

Fresh baseline with the same fail-closed binary settings:

| Verification | Result |
|---|---:|
| Complete default safe core-service suite | **301/301**, 8 suites |
| Facility isolation (included above) | **45/45**: 29 query + 16 compatibility |
| Vendor security (included above) | **90/90** |
| Other default core tests (included above) | **166/166**: Contact 56, FollowUp 107, lifecycle 3 |
| Core authentication security, run in contract-service | **31/31** |
| Opt-in #5 evidence | **323 pass / 20 intentional fail / 343 total** |

Core command: `npm test -- --runInBand --silent`. Authentication command from `contract-service`: `npm test -- --runInBand --silent --runTestsByPath src/security/_tests_/coreAuthentication.security.test.js`. Both use the same explicit MongoMemoryServer environment shown above. No additional normal standalone Work Order test suite was found beyond Facility coverage. No application startup or deployed-runtime verification was performed.

JavaScript syntax checks passed for both new evidence files. `git diff --check` and explicit untracked-artifact whitespace checks passed. No production files are changed. Final Git status contains only the three untracked evidence artifacts: configuration, test file and this report. Temporary links to existing test dependencies were removed after verification. Main remains clean at `a7ad89724722b999bb0b201ae894142eae82c8ea`; Interaction remains clean at `2c8776975c54f13bfeb580b9c96cd9fb3f4c4fa4`; the Vendor worktree is also clean and unchanged. No commit, push or Gitea mutation was performed.


## Accepted human policy follow-up — 2026-09-15

The user accepted the reproduction findings and the following policy after the
reproduction above. Earlier POLICY DECISION REQUIRED classifications and Git-state
statements describe the original checkpoint and remain historical evidence.
This follow-up authorizes evidence preservation, publication and read-only
pre-remediation inspection, **not production remediation**.

### Parent authorization and roles

- The parent Work Order is the primary authorization boundary for every
  subresource operation. Each handler must first establish access through the
  applicable selected/authorized Facility scope. An ID alone grants no access.
  Cross-Facility parent access or mutation is prohibited. Prefer non-disclosing
  behavior consistent with established Work Order/API policy.
- Admin may read and mutate within authorized scope. Canonical technician may
  read and mutate operational subresources within authorized scope.
- Customer has no internal subresource mutation permission except a separately
  established, explicitly narrower customer workflow.
- Viewer gains no mutation permission. Preserve read behavior only where already
  authoritative; otherwise deny rather than inventing access.
- Legacy `tech`, missing and unknown roles, and anonymous, invalid or expired
  authentication are denied. Do not broaden roles for compatibility.

### Equipment and other references

- Equipment represented by an Asset must exist and be visible/authorized in the
  same selected Facility context as the parent WO. Inaccessible/foreign Asset
  identity must not be disclosed. Cross-Facility attachment is prohibited; #5
  introduces no shared-equipment or loaner exception. A future exception needs
  an explicit model and policy.
- Do not invent Part Facility ownership. Require parent authorization, Part
  existence/current valid semantics, and non-disclosing errors. Enforce any
  established Part ownership boundary if found; otherwise record ownership as a
  separate policy question rather than redesigning Part in #5.
- Do not invent Procedure/Task Facility ownership. Require authorized parent,
  reference existence/current validity, safe malformed/missing-ID behavior, and
  no stack/internal-error disclosure. Measurement-unit correctness stays in #9.

### Delegation, general update and errors

- Do not introduce creator-only labor/travel editing. Preserve authorized
  technician operational editing within the parent's Facility scope. Actor/audit
  fields remain server-controlled where currently defined. Future delegated-log
  ownership policy is separate.
- Whole-WO update is in #5 scope: it must not attach foreign equipment, spoof
  nested technician/actor identity, inject or replace protected nested data, or
  bypass dedicated validated subresource endpoints. Use explicit mutable-field
  allowlisting or equivalent narrow protection without redesigning unrelated WO
  editing.
- Malformed/nonexistent procedure/result/subresource IDs must return stable safe
  errors without raw Mongoose errors, stack traces or implementation details.

### Evidence preservation and next boundary

The original **323 passing controls/observations and 20 intentionally failing
security assertions** remain the accepted reproduction results. The entire test
file and opt-in configuration are unchanged; this follow-up does not rewrite
historical observations to match future policy. Original P0/P1/P2 findings,
NOT REPRODUCED findings, endpoint inventory and policy ambiguities are preserved.

The authorized evidence-only commit is
`test: reproduce Work Order subresource authorization defects`, followed by pushes
to Gitea/GitHub and a checkpoint comment on open Gitea #5. Remediation has not
begun. After that checkpoint, inspect Part/Procedure/Task ownership, broad-update
fields, viewer/customer reads and active frontend nested-update dependencies
read-only, and report any remaining human decision. Do not begin #6/#7/#9 or CRM
feature work.


## Remediation verification — 2026-09-15 (uncommitted)

The user authorized remediation after evidence commit
`72837f3c77f39fdba96055b03e8be8c93faa8165` and Gitea #5 evidence comment 52.
This section supersedes earlier “remediation has not begun” statements as current
working-branch status; those statements remain accurate historical checkpoints.
**No remediation commit, push, merge or Gitea update/closure has been performed.**

### Implementation and authorization

The only production file changed is `core-service/src/routers/workOrderRouter.js`.
No model, dependency, lockfile, cost calculation, unit mapping, Contract, Vendor,
Interaction or other feature implementation was changed.

- Parts read/add/update/remove now require an authorized parent before child
  validation. The handlers repeat the scoped parent query. Document saves retain
  their existing hooks and additionally constrain the actual write to the
  authorized predicate, native parent ObjectId and loaded Facility. A tested
  parent-Facility change between lookup and save rejects the write, including for
  global admins. Missing/inaccessible parents return 404; malformed IDs return
  safe 400-class errors.
- Equipment add/remove now use the canonical admin/technician role gate and the
  same parent authorization. Attachment validates Asset existence and composes
  existing visibility with exact parent-Facility equality, including under global
  admin context. Foreign and nonexistent Assets return the same generic 404.
  No loaner, cross-Facility or newly invented reference-ownership exception exists.
- Equipment addition returns only `{ message: 'Test equipment added' }`. Active
  frontend actions discard the response and revalidate the Work Order; they do
  not need the previous full nested WO response. Removal retains its acknowledgement
  and idempotent behavior for an absent, well-formed equipment ID.
- Whole-WO PUT accepts only `description`, `workOrderType`, `priority`, `status`,
  `scheduledDate`, `dueDate`, `completionDate`. This preserves ordinary operational
  scalar editing and the active completion request. `Archived` is rejected here;
  the existing admin-only archive route remains the archival path. Unknown or
  protected fields, arrays as request bodies, empty updates, dotted paths and
  update operators return 400 before mutation. The server builds `$set` and stamps
  canonical `updatedBy`. Existing schema validation remains enabled.
- Protected general-update fields include all labor/travel/part/equipment/procedure
  arrays and results; Facility/Asset/Contract/identity links; actor/audit/deletion
  fields; costs, provenance and other non-allowlisted data. `vendorService` and
  Contract economics were not redesigned; they are not ordinary-edit inputs, and
  no active ordinary frontend caller sends them.
- Dedicated procedure/result paths retain parent authorization and current unit
  mapping. Procedure and Task IDs receive safe syntax/existence checks; malformed
  result entries are rejected before writes. No Facility, membership/version or
  inactive/retired policy was invented. Stack/Mongoose details are no longer
  returned. Existing actor stamping and separate TaskResult persistence remain.
- Labor/travel handlers and their mutation helper were not rewritten. Their shared
  parent middleware now safely handles invalid/missing/disallowed selected-Facility
  contexts instead of risking uncaught async rejection. The previously blocked
  context-error cases are covered by permanent endpoint tests.

Internal detail and parts reads now explicitly require admin or canonical
technician. Earlier same-Facility customer/viewer/legacy/missing/unknown read
successes were reproduced behavior, not an authoritative entitlement; the accepted
policy instructed denial where no authoritative read policy exists. All internal
subresource mutations deny these roles. Anonymous requests return 401 and
invalid/expired tokens return 403. Admin/technician access remains subject to
parent scope; no role was broadened. Generic parent visibility and unselected
admin visibility retain the existing helper's behavior. Equipment attachment still
requires an actual matching parent Facility.

### Compatibility and deferred work

- The active completion caller sends `status` and `completionDate`, both retained.
  Other nested UI actions use dedicated endpoints. Their optimistic local state
  updates are not broad PUT requests. No active nested broad-update dependency was
  found. Existing client typing of the equipment-add result as Asset was already
  inconsistent with the old WO response; active callers consume no response fields.
- General PUT retains its existing `{ message, workOrder }` envelope. The frontend
  service's broader WorkOrder typing/cache assumption is pre-existing and was not
  redesigned in #5. The tested HTTP completion operation succeeds and persists the
  requested fields; a deployed/browser workflow was not executed.
- Part/Procedure/Task schemas and ownership semantics are unchanged. Part ownership
  inconsistency and Procedure/Task ownership ambiguity remain deferred. Existing
  nonmember but real Task references remain accepted; nonexistent Tasks are rejected.
- Creator-only labor/travel restrictions were not introduced. Dedicated actor/time
  stamping remains, while general nested replacement is blocked.
- #7 stale query-update costs and #9 unit mapping are explicitly covered as unchanged
  compatibility observations. They remain defects/debt for their own authorized
  work. Unmounted labor/travel PATCH helpers remain workflow debt. None was fixed
  or updated externally.

### Frozen evidence interpretation

Original reproduction: **323 passing controls/observations; 20 intentional security
failures**. After remediation, using the identical test file: **290 pass / 53 fail
/ 343 total**, with **20/20 original security assertions passing unchanged**.
SHA-256 of the entire frozen test remains
`c73a9b3fd7b75609237d71c45e2b6d0fadb0c684535428e72e305223558eade0`.

The 53 failures are obsolete pre-policy expectations: 21 role-matrix cases,
18 observations, 13 old error-status/detail expectations, and one control-labeled
case. That one case (`authorized equipment add succeeds on own Work Order`) sends
Facility B's Asset to Facility A's WO. Its parent is authorized, but its reference
is prohibited by the accepted policy. It remains untouched. All other **89
control-labeled cases pass**. Therefore it would be incorrect to claim every
historical control remains valid under the new policy. No original security
assertion conflicts with the accepted policy, and none was edited or skipped in
the full frozen run.

For a green security-only evidence run, use the original opt-in command with
`--testNamePattern '^SECURITY:'`: 20 cases execute; 323 are excluded by the test-name
selection. The full frozen suite remains historical evidence and deliberately
returns exit 1. The permanent suite is the normal green regression contract.

### Permanent coverage and final verification

`core-service/src/routers/_tests_/workOrderSubresourceSecurity.test.mjs` adds
**295 permanent tests**, discovered by the existing Jest configuration without
new tooling or dependencies. Coverage includes direct role/auth matrices for the
19 operations, same/foreign parent controls, Part mutations, equipment reference
privacy and response shape, ordinary-update allowlisting and bypass attempts,
procedure/result errors, safe context handling, save-time scope changes, generic
visibility, shared references, and deferred cost/unit behavior.

| Verification | Result |
|---|---:|
| Permanent #5 suite | 295/295 |
| Complete safe core | 596/596 = existing 301 + new 295 |
| Facility isolation (included in core) | 45/45 |
| Vendor security (included in core) | 90/90 |
| Other existing core (included in core) | 166/166 |
| Core authentication security | 31/31 |
| Original frozen security assertions | 20/20 unchanged |
| Full frozen historical suite | 290 pass / 53 obsolete expectations fail |
| JavaScript syntax | PASS |
| `npm ls --depth=0` | PASS; no dependency changes |
| Tracked and new-file whitespace checks | PASS |

All database-backed verification uses the established fail-closed MongoMemoryServer
harness, the explicitly selected cached MongoDB binary, and disabled downloads.
A permanent test rejects both configured and unrelated loopback database targets.
No real database fallback, application startup, deployed-runtime verification,
Docker, scheduled job or external service call occurred. Existing Node experimental
and duplicate-index warnings were not altered.

Read-only final review confirmed the frozen evidence is byte-for-byte unchanged,
production scope is limited to the router, and all permanent tests are green.
Only router/test/report changes remain uncommitted. Temporary links to existing
test dependencies were removed after verification; no packages were changed.
Main and paused Interaction are not modified. **PASS for the accepted #5 policy**,
with the explicitly documented historical-evidence failures and deferred concerns.
Await human review before commit, push, merge or Gitea action.


## Final commit-gate review — 2026-09-15 (uncommitted)

**PASS. No commit, push, merge or Gitea mutation authorized at this gate.**

### Caller and read-policy conclusions

- Ordinary PUT caller tracing found `updateWorkOrder` -> `useWorkOrderForm` ->
  `EditWorkOrderPage` completion, which sends only status/completionDate. Form
  description/scheduling/status controls change local cache; they do not submit
  extra protected fields. The seven-field allowlist remains unchanged. Assignment
  and scheduling have dedicated PATCH handlers; no active ordinary-PUT caller was
  found needing assignment, department or Contract attribution. Backend services
  have no additional active ordinary-PUT caller. The legacy EJS form includes
  assetId, but no active render/include route to that view was found. Its presence
  is not grounds to broaden authorization or revive it.
- The equipment API client incorrectly described addition as returning Asset and
  removal as untyped data. Both now explicitly return `EquipmentAcknowledgement`
  (`{ message: string }`). This is a narrow client/type correction in
  `frontend/src/services/workOrderAPI.ts`; backend responses remain narrow. Active
  `useWorkOrderActions` callers update local state then refetch. They do not consume
  returned testEquipmentUsed, labor, travel or procedures. Five mock-only tests in
  `frontend/src/services/workOrderEquipmentAPI.test.ts` verify request/response
  compatibility, response types and both hooks' refetch behavior.
- General GET `/workorders/:id` and dedicated internal reads are distinct routes.
  The general response nevertheless contains internal labor/travel/procedure/parts
  data. Prior same-Facility customer/viewer success did not establish a separate
  approved entitlement to those fields. No authoritative narrower read workflow
  was found. Viewer navigation includes Work Orders, and Contract/Asset views have
  detail links; these links are not proof of approved internal authorization and
  may now lead to denial for unsupported roles. No new read role was granted and
  no customer-specific projection or workflow was invented. Secured behavior
  follows the accepted #5 deny-by-default policy. Any future customer/viewer detail
  workflow requires explicit read/projection policy, outside this commit gate.
- Procedure/result malformed IDs return safe 400, missing references return 404;
  valid authorized cases pass and foreign parents remain denied. No stack/Mongoose
  details are returned. The production diff does not change WorkOrder cost hooks,
  labor-rate snapshots, lifecycle totals, measurement-unit mapping or Task/Procedure
  schemas. #7/#9 compatibility tests remain green; their defects are deferred.

### Frozen evidence remains historical

The original evidence file is byte-for-byte unchanged. Before remediation: 323
observations/controls passed and 20 security assertions intentionally failed.
After remediation: all 20 security assertions pass unchanged, and 89 originally
control-labeled cases pass. The remaining originally control-labeled foreign-Asset
attachment case is a **historical pre-policy observation**, not an authoritative
expected-success control. Remaining full-suite failures describe behavior removed
by the accepted policy. The permanent **295-test #5 suite is authoritative for
ongoing regression**. No frozen assertion was changed to make the suite green.

### Fresh verification

- Original security assertions: 20/20 (security-only name selection; the other 323
  frozen cases are not selected by that command, not edited or permanently skipped).
- Complete safe core: 596/596, including permanent #5 295/295, Facility 45/45,
  Vendor 90/90 and other existing core 166/166.
- Authentication security: 31/31.
- New frontend equipment API/hook tests: 5/5, mocked requests only.
- Whole frontend TypeScript: PASS using
  `tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 5.0`, the established
  baseline-compatible override; no tsconfig or dependencies changed.
- JavaScript syntax, npm dependency consistency, diff/new-file whitespace and
  security scope review: PASS.

There are now two production files in the pending remediation: the Work Order
router and the equipment client/type correction. Pending tests are the permanent
backend suite and five frontend tests; this journal is the only documentation
file changed. No real-data, deployed-runtime or browser end-to-end verification
was performed. Existing ordinary-PUT response-envelope/cache debt is unchanged
and not caused by the allowlist or equipment response correction.

Dependency-check qualification: core and frontend `npm ls --depth=0` exited 0.
The reused frontend dependency tree reports extraneous-package warnings; no
installation, removal, dependency or lockfile edit was performed. Temporary
dependency links were removed after verification. Final Git state contains only
the two production files, two test files and this journal, all uncommitted.


## Approved remediation publication checkpoint — 2026-09-15

The user approved documentation, commit and push after the final commit-gate
review. Earlier uncommitted/unpublished statements describe those earlier stages.
The commit containing this section records the verified #5 implementation and
compatibility changes on `fix/workorder-subresource-ownership`; it does not merge
or resolve #5 on main. The issue remains open pending main integration.

Fresh publication verification passed original security 20/20 unchanged, permanent
#5 295/295, complete safe core 596/596 (Facility 45/45, Vendor 90/90 included),
authentication 31/31, frontend equipment 5/5, baseline-compatible TypeScript,
JavaScript syntax, dependency consistency and whitespace/security scope checks.
The fail-closed harness and frozen evidence remain unchanged. No additional
production changes were required after the final review. The existing historical
interpretation remains: 89 control-labeled cases pass; the foreign-equipment former
control is a pre-policy observation; the full frozen suite is not the normal green
regression contract. The permanent 295-case suite is authoritative.

Current Context and Open Threads now record #3/#4 as resolved/merged, #5 verified
on its fix branch but not merged, #6 unstarted and new features paused. Costs (#7),
units (#9), reference-ownership questions and unmounted labor/travel PATCH helpers
remain deferred. No cost/lifecycle computation, labor-rate snapshot, Task/Procedure
schema/unit, Part ownership, dependency/lockfile, Contract/Vendor/CRM implementation,
Interaction or Opportunity change is included. No real-data/deployed-runtime
verification was performed. Authorized publication consists only of this fix-branch
commit/push and a #5 checkpoint comment; no merge or issue closure.


## Verified main merge — 2026-09-15

Main advanced from `a7ad89724722b999bb0b201ae894142eae82c8ea` by clean fast-forward
to fix `30e521113749b01987ffbbb10381ed80cf736d0f`. No squash, rebase, implementation
conflict or history rewrite occurred. Earlier fix-branch-only status is historical.

Fresh merged-main checks passed: permanent #5 295/295, original security 20/20
unchanged, Facility 45/45, Vendor 90/90, complete safe core 596/596, authentication
31/31 and frontend equipment compatibility 5/5. Baseline-compatible TypeScript,
JavaScript syntax, npm dependency consistency, whitespace and security scope
checks passed. The reused frontend dependency tree still reports extraneous
warnings; no dependencies or lockfiles changed.

The passing cases verify foreign-parent Parts read/add/update/removal denial;
scoped equipment operations and same-Facility Asset validation without foreign
identity disclosure; canonical mutation roles and acknowledgement-only responses;
ordinary PUT allowlisting against nested, identity, actor, audit, deletion, cost,
dotted-path and operator injection; safe Procedure/result ID errors and preserved
foreign-parent denial. Costs (#7), units (#9) and Part/Procedure/Task ownership
models remain unchanged. Fail-closed synthetic persistence was used throughout;
no real-data or deployed-runtime verification was performed.

This documentation-only checkpoint records #3/#4/#5 code remediation as merged
and verified on main. #6 has not started; #7/#9 remain separate and new features
remain paused. Gitea #5 final closure is pending the separately verified merge of
main into paused Interaction. Interaction must not be merged into main. Publication
and final issue status are recorded by Git refs and Gitea after those actions.
