# S2 — Test-equipment picker Facility authorization

Date: September 21, 2026. Status: reproduction complete; **CONFIRMED BUG — P0**.
Production remediation, publication, issue mutations and the broader P0 gate
rerun are not part of this task and were not performed.

## Verified starting point and scope

Before creating the worktree, local main was clean and its hash matched both
live Gitea/GitHub main refs:
`2f7bea84f2585eb6de14f3706c4b744b4719ab1b`.

Dedicated branch/worktree: `fix/test-equipment-picker-scope` at
`/tmp/cronus-test-equipment-picker-scope`, based on that exact commit.
Paused Interaction remains `e242b2044cca33a09359bc37cf2bdb1a0c7641a6`.
S3's accepted P1 evidence/tracking branch is separate and untouched. #7, #14,
#15 and CRM work were not begun. Current assignment labels are authoritative:
S2 is the equipment picker; some historical sweep notes reversed S2/S3 numbering.

Only three new files belong to this task: the opt-in reproduction, its Jest
configuration and this journal. Existing source, tests and AI Memory are unchanged.

## Finding

An authenticated canonical technician whose **fresh claims authorize only
Facility A**, requesting `GET /assets/test-equipment` with selected Facility A,
receives a distinguishable Facility B Asset solely because B's Asset is assigned
to that technician. The response includes material operational fields and the
populated Template. The same caller's ordinary Asset detail for B returns 404,
and its ordinary Asset list excludes B.

This is actual persistence-backed cross-Facility disclosure, not an inference
from a missing predicate. **CONFIRMED BUG — P0** under the task's classification.
No examined policy establishes assignment as an independent cross-Facility read
grant. Existing #5 policy instead prohibits disclosing inaccessible/foreign
Asset identities through equipment workflows. Downstream attachment rejection
does not make the preceding disclosure harmless.

## Architecture and role model

- `core-service/app.js:80` mounts the actual assetsRouter at `/assets`.
- `core-service/src/routers/assetsRouter.js:164` registers the picker before
  `/:id`. It runs authenticateToken but no authorizeRoles or Facility helper.
- Its database predicate is **only** `{ assignedTo: req.user.id }`. It populates
  templateId with `match: { isTestEquipment: true }`, calls lean(), then removes
  rows whose populated templateId is null. Neither Asset nor Template has an
  explicit response projection in this query.
- `Asset.js` declares required facilityId (Facility reference) and optional
  assignedTo (User reference, commented as used for test equipment). It also
  holds identity, operational, lifecycle, financial and audit information.
  assignedTo is a reference, not a declared authorization capability.
- Eligibility here is the populated Template's isTestEquipment flag, not Asset
  subtype/discriminator, calibration status or Facility. A non-test Template,
  missing Template and null Template are all excluded in passing controls.
- authenticateToken verifies signature/expiry/issuer/audience and obtains user
  ID and Facility claims from the JWT. It does not reload current User authority
  on this route. Missing/unknown/legacy roles are not rejected by authentication
  alone; role restrictions require the separate authorizeRoles middleware.

### Existing hardened Facility contracts

`operationalOwnership.selectedFacility` requires explicit valid context,
non-admin authorization and Facility existence. #6 accepted this requirement for
Asset creation; creation uses it. `ownership.visibility` validates an explicit
selected Facility and non-admin authorization; without selection it delegates
to existing default/global read behavior. `buildTenantFilter` scopes non-admin
reads to selected Facility or the token default and has an existing admin global
read branch without a header. These helpers are **not called by the picker**.

#6 ordinary Asset edits disallow facilityId and assignedTo changes. Tests confirm
admin PUT attempts to change either field return 400 and leave the row unchanged.
These safeguards do not sanitize historical assignments or protect this read.

Do not extend #6's explicit-creation-context requirement to every Asset read by
assumption. The picker currently does not require context for any role. General
Asset read behavior does not by itself establish an accepted admin global-picker
entitlement; explicit admin picker semantics remain a human design decision.

## Frontend and Work Order callers

`frontend/src/services/assetAPI.ts:getTestEquip` calls the shared apiClient's
GET `/assets/test-equipment`, without its own Facility parameter. The interceptor
in `apiClient.ts` attaches `x-facility-id` from localStorage.selectedFacilityId
when present (and preserves an explicitly supplied header). Thus the frontend
normally supplies selected context, but does not require it at this call site.

`useTestEquipment.ts` uses the static SWR key `test-equipment`; the modal maps
returned rows and displays ctrlNumber/manufacturer/model without a Facility
filter. Static cache-key/context-change behavior is a source observation only;
no browser/cache-race reproduction or frontend implementation was attempted.
The disclosure assertion is established by HTTP/persistence tests regardless
of frontend rendering or cache behavior.

The attach callback calls `POST /workorders/:id/test-equipment`. The hardened #5
handler authorizes the parent Work Order, checks Asset existence under caller
visibility **and the parent Work Order's Facility**, and returns only an
acknowledgement. No loaner/cross-Facility exception is granted, including to admin.
Accepted policy is preserved in the Work Order subresource journal's
"Equipment and other references" section and #6's accepted ownership policy.

## Isolated fixture and execution model

The existing fail-closed MongoMemoryServer harness uses an existing cached binary
and disables runtime downloads. Configured or arbitrary Mongo targets are
explicitly rejected by a passing control. All users, Facility/Organization IDs,
Assets, Templates, Work Orders, notes and financial values are synthetic.

Fixtures include A and B; A-only technician A; B-only technician B; admin; and
customer/viewer/legacy/missing/unknown role users with A-only authority. Each
caller has distinguishable assigned test equipment in both A and B. The primary
controls are A/assigned-to-A, B/stale-assigned-to-A, B/assigned-to-B and unassigned
A/B equipment. Synthetic User rows include matching current authorization claims.

The harness evaluates the real app.js registration with actual Asset/Work Order
routers and auth middleware. DB startup, listen callback, scheduled-job startup,
dotenv startup and unrelated routers are disabled. External Axios transport is
blocked. No provider request or deployed application process was invoked.

## Selected-Facility and authentication matrix

All validly signed callers tested receive **only their own assigned A and B
Assets**, regardless of selected header. Assignment limits which foreign rows
leak; it does not prevent the foreign rows from leaking.

| Caller | Selected A | Selected B | Missing context | Malformed context | Nonexistent context |
| --- | --- | --- | --- | --- | --- |
| A-only technician A | 200, own A+B | 200, own A+B despite unauthorized B | 200, own A+B | 200, own A+B | 200, own A+B |
| B-only technician B | 200, own A+B despite unauthorized A | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| admin | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| customer | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| viewer | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| legacy tech | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| missing role | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| unknown role | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B | 200, own A+B |
| anonymous | 401 | 401 | 401 | 401 | 401 |
| invalid / expired authentication | 403 | 403 | 403 | 403 | 403 |

No middleware rejects unauthorized or malformed Facility selection on this
picker. The header is simply unused. Error responses for denied authentication
do not contain fixture identifiers. These tests do not claim signature or expiry
bypass. Admin without any assigned Assets gets an empty list, not all equipment.
A caller with no Facility claims still receives its assigned Assets. An A+B
technician explicitly selecting B still receives assigned A+B equipment.

### Primary A-only selected-A outcome

| Fixture | Returned? |
| --- | --- |
| A assigned to technician A | Yes: authorized positive control |
| B stale-assigned to technician A | **Yes: unauthorized disclosure** |
| B assigned to technician B | No |
| Unassigned A | No |
| Unassigned B | No |

## Precisely verified disclosure categories

The foreign response contains synthetic values for:

- `_id`, ctrlNumber/tag, manufacturer, model, serialNumber and description.
- facilityId and assignedTo identifiers (not populated User/Facility profiles).
- locationNote and internal notes; attributes containing a distinguishable marker.
- status, isArchived, deletedAt, metrics and maintenanceSchedule.
- purchaseCost; source/schema inspection shows no projection limiting other stored
  financial fields, but only seeded values are claimed as runtime verified.
- createdBy, createdAt, updatedAt and __v; documents/images fields are present
  (empty arrays in this fixture, not a reproduced document-content leak).
- Populated Template identity, description, isTestEquipment and benchmark.notes.

This is materially more than a minimal picker label. The foreign Asset's
operational fields are protected by Facility scope elsewhere. Template is shared
catalog data; its population is not independently characterized as a tenant leak.

## Lifecycle and query observations

Inactive and Retired assigned Assets remain in the picker. An Asset archived by
the **actual admin Asset archive route** remains returned with status Archived
and non-null deletedAt. These are observations of current semantics, not a newly
accepted test-equipment lifecycle policy or #14/#15 remediation work.

The picker exposes no implemented search/filter/query contract. Tests for
facilityId, assignedTo, search, status, `$or` and bracketed Facility operators
leave the assignment-derived response unchanged. They neither override assignment
nor repair the absent Facility predicate. General Asset search is not reinvestigated.

## Downstream #5 protection

Actual mounted attachment tests confirm:

- Technician A attaching the disclosed B Asset to A's Work Order: **404**, parent
  persistence unchanged.
- Admin attaching the same B Asset to A's Work Order: **404**, unchanged.
- Technician A and admin attaching the local A Asset: **200**, reference persisted.
- A-only technician selecting unauthorized B during attachment: **403**, unchanged.

The response disclosure is therefore independently vulnerable while the #5
same-Facility mutation boundary remains effective for these cases.

## Stale-assignment plausibility and limits

- Asset assignedTo has no schema-level invariant linking the assignee's current
  Facility grants to Asset.facilityId. Examined User middleware hashes passwords;
  no cross-Asset assignment reconciliation on Facility changes was found.
- A synthetic authorization-change observation updates a User's grants from A+B
  to A, leaves the assigned B Asset intact, and sends fresh reduced A-only claims.
  The picker still returns B. This is not dependent on an old token retaining B.
- The mounted User update route does not provide Facility-grant editing; the
  mounted Facility router is read-only. This task did not establish which real
  administrative process changes grants. Such changes and their actual usage
  remain unverified; no real data was accessed.
- Current #6 Asset create allowlists omit assignedTo; ordinary update rejects
  assignedTo/facilityId, and no mounted dedicated Asset assignment route was found
  in the inspected router inventory. Work Order assignment is a different field
  and now validates assignee eligibility; it does not reconcile Asset assignments.
- Historical/pre-#6 data can retain assignment/ownership mismatches because #6
  did not normalize real data. This is plausible historical context, not proof
  any deployed row is inconsistent. No transfer, seed, import or repair was run.

Reproducing an authorized current route that manufactures stale assignment is
not necessary to establish the picker boundary failure. The test demonstrates
that persisted inconsistent assignments are trusted over current Facility claims.

## Minimal remediation proposal — not implemented

Compose an authoritative Facility predicate with the existing assignment and
test-equipment eligibility predicates. Never accept assignedTo as an independent
cross-Facility read grant. Validate selected context/authorization before query,
use non-disclosing errors, and keep authorization separate from any future search
filters. Retain #5's parent/same-Facility revalidation on attachment. Consider an
explicit minimal picker response projection to limit unnecessary exposure.

Before implementation, confirm these narrow API-policy choices:

1. Explicit selected Facility for this operational picker, including admin,
   versus any deliberately supported missing-header/default behavior. Existing
   Asset creation requires selection, but generic reads permit default/global
   branches; no picker-specific admin global entitlement was found.
2. Exact allowed picker roles. Canonical admin/technician matches internal
   equipment attachment, but current picker has authentication only. Do not infer
   intended customer/viewer/legacy read grants from current implementation.
3. Whether assignment remains an additional eligibility filter or admins may
   view other authorized same-Facility equipment; whether inactive/archived
   equipment should be excluded. Preserve type/calibration semantics unless
   explicitly changed.

No policy decision is needed to recognize A-only access to material B data as
P0. No documented independent assignment grant was found. These decisions refine
remediation behavior, not downgrade or defer classification of the disclosure.

## Preserved evidence and baselines

New opt-in files:

- `core-service/jest.test-equipment-picker-reproduction.config.cjs`
- `core-service/src/routers/_tests_/testEquipmentPicker.reproduction.mjs`

Reproduction: **91 total = 11 passing controls + 69 passing observations + 11
intentional security failures**. No harness/control/observation failures.
The security assertions preserve five A-only technician context variants, five
other-role foreign-disclosure variants and one empty-Facility-claims case. They
assert absence of the inaccessible Asset ID without presuming an exact future
error code, global-admin policy or blanket role rule. Do not rewrite them green.

Unchanged baselines passed:

| Suite | Result |
| --- | --- |
| Supplier #13 | 59/59 |
| Facility #3 | 45/45 (29 + 16) |
| Vendor #4 | 90/90 |
| Work Order subresources #5 | 295/295 |
| Ownership #6 | 215/215 (214 + standalone 1) |
| Complete safe core | 870/870, 12 suites |
| Authentication | 31/31 |

The safe core total includes the component counts, Contact 56, FollowUp 107 and
lifecycle 3. It excludes opt-in evidence and paused Interaction. Authentication
runs separately with its existing fail-closed synthetic core/contract harness.
Prior suites were not changed. Node/Jest experimental and duplicate-index
warnings remain existing environment/schema observations.

Reproduce from core-service with existing dependencies and cached binary:

```sh
NODE_ENV=test MONGOMS_SYSTEM_BINARY=/tmp/cronus-mongodb-cache/mongod-x64-debian-8.2.1 \
MONGOMS_VERSION=8.2.1 MONGOMS_RUNTIME_DOWNLOAD=false \
node --experimental-vm-modules --experimental-specifier-resolution=node \
node_modules/jest/bin/jest.js --config jest.test-equipment-picker-reproduction.config.cjs \
--runInBand
```

Expected: nonzero exit from eleven intentional security failures. Filter
`--testNamePattern='^(CONTROL|OBSERVATION):'` for the 80 passing cases or
`--testNamePattern='^SECURITY:'` for the preserved boundary expectations.

## Handoff and verification limits

No production code, schema, prior suite, dependency manifest, AI Memory or
existing journal was modified. New test/config syntax and whitespace were checked;
tracked-file diff remains empty. Temporary dependency links reuse existing
packages and are removed at handoff; no installation occurred.

No commit/push, issue mutation, real database, deployed service, provider call,
container or scheduled job was touched. Read-only Git remote-ref checks preceded
worktree creation. All persistence was ephemeral and synthetic. Frontend header
and picker behavior were inspected in source, not browser-tested. Actual deployed
assignment prevalence, grant-change workflows and stale-token behavior remain
unverified. No broader P0 gate rerun occurred. Stop at this evidence checkpoint.


## Accepted picker policy and remediation authorization — September 21, 2026

The user accepted S2 as confirmed P0 cross-Facility disclosure. Preserve the
91-case evidence (80 passing controls/observations, 11 intentional failures),
including the original policy ambiguities and all eleven security assertions.
These decisions supersede ambiguities prospectively; they do not rewrite history.

Accepted policy for GET /assets/test-equipment:

- Every request, including admin, requires explicit selected Facility context
  validated using established hardened Asset/CRM authorization. Missing,
  malformed, nonexistent and unauthorized context must fail safely. No default,
  first-Facility, assignment-only or global-admin fallback.
- Only canonical admin and technician are allowed. Customer, viewer, legacy tech,
  missing/unknown roles and anonymous/invalid/expired authentication are denied.
- Results must satisfy authorized selected Facility, Asset ownership in that
  Facility, assignment to the authenticated caller, test-equipment Template
  qualification and authoritative Asset active/deletion semantics together.
  Assignment is not an independent cross-Facility read grant; no equipment
  exception is introduced. Admin remains selected-Facility/personally assigned.
- Return only identity/display fields required by active picker consumers after
  inspecting them. Omit internal notes, financial data, lifecycle/calculated
  values, audit/unrelated ownership metadata and full Template documents.
- Preserve #5's separate same-Facility Work Order attachment authorization.
- Safe stable errors must not disclose inaccessible Facility/Asset identity.

Checkpoint 1 authorizes this evidence/policy commit, publication to Gitea/GitHub,
and creation of an open P0 issue. The P0 gate remains blocked pending remediation.
Checkpoint 2 authorizes the narrow fix, permanent isolated regressions, frontend
compatibility where required and final verification/review. The original eleven
security assertions must pass unchanged after production remediation; obsolete
observations stay frozen. Remediation must remain uncommitted/unpushed, the issue
open, and the broader P0 gate rerun deferred. #7/#14/#15/CRM work remains paused.
