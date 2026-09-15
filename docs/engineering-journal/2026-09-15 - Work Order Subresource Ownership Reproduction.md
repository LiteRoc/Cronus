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
