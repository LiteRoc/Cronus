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

## Evidence publication and local remediation review — September 21, 2026

Evidence/policy commit: `ed51a0e1eab67ef00fc7501b4f7557c22c84b0aa`
(`test: reproduce test-equipment picker Facility disclosure`). Both Gitea/GitHub
pushes succeeded and live branch refs were verified against that commit before
remediation began. Created [Gitea #16 — security: Enforce Facility authorization
on test-equipment picker](http://192.168.1.185:3000/LiteRoc/cronus/issues/16),
labelled P0 and open. The issue records the evidence, accepted policy, isolated
regression requirement and blocked P0 gate. No remediation commit/push or issue
closure is authorized at this review checkpoint.

### Local implementation (uncommitted)

The production backend diff is confined to the picker handler in assetsRouter.
It authenticates, gates canonical admin/technician, then calls the existing
operationalOwnership.selectedFacility helper. Missing/malformed context returns
400, unauthorized context 403, and an authorized but nonexistent Facility 404.
Unrecognized roles are denied before Facility/Asset lookup. Unexpected failures
use the shared generic error response; inaccessible IDs/internal errors are not
echoed. Admin has no missing-context/global fallback. Existing helper semantics
use explicit claims for non-admin authority and admin authorization for an
explicitly selected existing Facility; helpers themselves were not changed.

The Asset query composes selected facilityId, authenticated assignedTo,
status=Active, deletedAt=null (including absent legacy deletion metadata), and
isArchived != true. Active status follows the normal Asset list default; deletion
and archive flags retain existing Asset archive/lifecycle semantics. This does
not modify any lifecycle schema or transition. Template qualification remains
isTestEquipment=true. Ineligible/missing Template population excludes the Asset.
No Template archive/UDI policy (#15), ownership redesign, loaner exception or
downstream attachment change was introduced.

The exact JSON row is **{ _id, ctrlNumber, manufacturer, model }**. The database
projection includes only those fields plus templateId needed for eligibility;
Template population selects only its ID and that ID is removed from the response.
No full Asset or Template is returned. Notes, serial, Facility/assignment IDs,
financial/lifecycle/calculated/audit data and arbitrary stored extras are omitted.

Active consumer inspection found only getTestEquip → useTestEquipment →
AddTestEquipmentModal, where the modal displays tag/manufacturer/model and sends
Asset ID to the existing attach callback. Four frontend production files changed:

- types/Asset.ts adds the narrow TestEquipmentOption identity/display type.
- services/assetAPI.ts requires explicit Facility for getTestEquip and sends its
  header explicitly, preserving it against stale localStorage interceptor state.
- useTestEquipment uses a Facility-keyed SWR cache, disables requests without a
  selection and does not keep previous-Facility options during key changes.
- AddTestEquipmentModal consumes TestEquipmentOption[]; display and attach
  behavior are unchanged and no Template-derived data is required.

The existing creation/edit helper payload types remain Asset-based because those
are separate operations. No client restores a full picker Asset response.

### Verification and frozen-evidence transition

- Permanent picker regression: **49/49**. Covers roles; admin/technician explicit
  context and authority; stale/other/unassigned equipment; multi-Facility
  selection; missing/non-test Templates; inactive/deleted/archived Assets;
  actual admin archive; exact response keys; query override attempts; safe lookup
  failures; malformed authenticated identity; and same-Facility attachment.
- Original eleven SECURITY assertions: **11/11 passed unchanged** (80 historical
  controls/observations intentionally skipped by the SECURITY filter). SHA-256
  comparisons confirm the entire frozen reproduction and config are byte-for-byte
  unchanged from before the evidence commit. Before was 80 passing + 11 failing
  out of 91; after, all eleven original boundary assertions pass. Historical
  observations describing ignored context, permissive roles and full responses
  are obsolete by design and are preserved, not rewritten to make the full old
  suite green. No claim is made that all 91 historical expectations now pass.
- Complete safe core: **919/919 across 13 suites = prior main 870 + picker 49**.
  Included baselines: Supplier 59, Facility 45 (29+16), Vendor 90, Work Order
  subresources 295, ownership 215 (214+1), Contact 56, FollowUp 107, lifecycle 3.
- Authentication: **31/31**.
- Frontend: **14/14** = new API/header/type 4 + Facility cache/state 4 + minimal
  modal display/selection 1 + existing Work Order equipment compatibility 5.
  Includes stale localStorage context, missing selection, independent request
  headers, immediate clearing on Facility switch and late old-response isolation.
- Application TypeScript passed with established
  `tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 5.0` override.
- Changed/new JavaScript syntax, new-file whitespace, git diff --check and
  focused security/scope checks passed.
- npm ls --depth=0 exited 0 in all three packages. Core/contract reported no
  problems; the reused frontend dependency tree reported 490 extraneous entries
  and no other problems. No install, upgrade or cleanup was attempted.

All database verification used the existing fail-closed synthetic harness with
runtime downloads disabled. No real database, deployed service, container,
provider or scheduled job was used. Existing Node/Jest and duplicate-index
warnings remain. Temporary dependency links are removed after verification.

### Final read-only review

**PASS for local final review.** Under A, stale B assignment no longer exposes B;
selected Facility is authoritative; admin requires selection and remains
personally assigned; inappropriate roles cannot query; minimal projection is
asserted exactly. #5's downstream same-Facility check is unchanged and verified.
#3/#4/#5/#6/#13 regressions remain green. Frozen evidence, schemas, shared helpers,
dependency manifests/lockfiles and previous suites remain unchanged. No Facility
ownership redesign or service-boundary change occurred.

This is an uncommitted local remediation result, not a merged/deployed fix.
Evidence-only HEAD/remotes remain ed51a0e; main and paused Interaction are
unchanged. #16 remains open, P0 is not declared cleared, and the broader gate
has not been rerun. #7/#14/#15 and CRM work were not started. Publication and
closure require a subsequent authorized checkpoint.

## Final commit-gate review — September 21, 2026

Result: **PASS**, with remediation still uncommitted/unpushed at evidence HEAD
ed51a0e. No issue mutation, merge, closure or broader P0 gate rerun occurred.

Repository-wide route/client searches and App/main mounting confirm the active
picker consumer chain is getTestEquip → useTestEquipment → EditWorkOrderPage →
AddTestEquipmentModal. Its only reads are _id for attachment and ctrlNumber,
manufacturer and model for display. No active consumer needs serial, description,
location, Facility/assignment IDs, Template, lifecycle or purchase information.
The existing four-field projection is sufficient; it was not expanded.

The explicit request header survives stale localStorage through the unchanged
Axios interceptor. SWR keys include selected Facility and disable missing-context
requests. Existing tests cover A→B clearing and late A success; two narrowly
necessary tests were added during this review: late A failure cannot populate
B's error state, and the active hook sends A/B selections through the real client
and interceptor while browser storage is stale. No production correction was
needed. Frontend verification is now **16/16** (API/integration 5, cache/state 5,
modal 1, existing equipment attachment compatibility 5).

Lifecycle review traced Asset's Active default/status enum, deletedAt/deletedBy,
isArchived boolean, actual admin archive's deletedAt + Archived writes, #6's
non-deleted update predicates and existing lifecycle archive filtering. The
picker combines those established fields; no state or transition was invented.
The older schema/route difference where archive writes Archived outside the
ordinary status enum is pre-existing and was not changed. Active eligibility,
actual admin archive exclusion, independent deletion/archive flags and legacy
absent deletion metadata are covered by permanent tests.

Role/context and privacy tests freshly verify canonical admin/technician only;
explicit selection including admin; selected-Facility/personal assignment;
stale foreign exclusion; safe 400/403/404 responses; and generic 500 on lookup
failures. #5 attachment remains unchanged: local succeeds, foreign returns 404
without changing the Work Order, including for admin. Its separate predicates
are not replaced or weakened by the picker.

Fresh commit-gate verification:

- Frozen original S2 SECURITY assertions: 11/11; entire evidence/config match
  ed51a0e byte-for-byte. Original before state remains 91 total, 80 passing and
  11 intentional failures. The 80 historical cases remain preserved/skipped in
  the post-remediation security-only run.
- Permanent picker: 49/49; complete safe core: 919/919, 13 suites.
- Included baselines: Supplier 59, Facility 45, Vendor 90, subresources 295,
  ownership 215; authentication separately 31/31.
- Frontend 16/16; application TypeScript with established compatibility override,
  JavaScript syntax, new-file whitespace, git diff --check and scope checks pass.
- npm ls --depth=0 exits 0 in all three packages. Frontend reports 490 extraneous
  entries and no other problems, reusing the existing dependency tree. The
  September 19 Supplier journal already recorded this exact warning before #16;
  all manifests/lockfiles match the evidence commit. No dependency mutation.

Only the two additional frontend test cases and this review record were added
in the commit-gate turn. Temporary dependency links were removed. Persistence
remained fail-closed, ephemeral and synthetic; no real database, runtime service,
container or provider was accessed. Browser deployment/manual end-to-end behavior
was not exercised. #16 was not updated or closed; #7/#14/#15/CRM remain untouched.

## Approved remediation publication checkpoint — September 21, 2026

The user accepted the final commit-gate review and authorized documentation,
commit and publication as `fix: scope test-equipment picker by Facility` on
fix/test-equipment-picker-scope. Earlier uncommitted/no-publication statements
above describe historical checkpoints. The commit containing this section is
the remediation checkpoint; Git records its hash and the post-push #16 comment
records publication results. No merge or issue closure is authorized. #16 is
not resolved on main and Interaction compatibility for this fix is outstanding.

Preserved before: 91 reproduction cases, 80 passing controls/observations and
11 intentional security failures. An A-only caller received material B Asset
information solely through stale assignment while selected Facility was ignored.
Preserved after: all 11 original assertions pass unchanged; the frozen suite and
configuration are byte-for-byte historical evidence. Permanent picker **49/49**
is authoritative for ongoing regression, with frontend compatibility/isolation
**16/16**. Obsolete historical observations have not been rewritten.

Final policy/implementation: canonical admin/technician only; explicit authorized
Facility required for both, with no global admin picker. Asset Facility equals
selection, assignment equals authenticated caller, Template qualifies as test
equipment, and established active/deleted/archive predicates apply. Assignment
is not an independent cross-Facility read grant. #5 downstream attachment
validation remains independent and unchanged. No ownership redesign or equipment
exception was introduced.

Exact response projection: `_id`, `ctrlNumber`, `manufacturer`, `model`.
All active consumers need only those fields. Frontend requests explicitly carry
selected Facility; the shared interceptor preserves that header. Facility-keyed
cache and disabled missing-context requests enforce A→B state isolation and
prevent stale A success/failure from populating B data/error state.

Fresh pre-publication verification passed:

| Check | Result |
| --- | --- |
| Original S2 security assertions | 11/11 unchanged |
| Permanent picker | 49/49 |
| Supplier #13 | 59/59 |
| Facility #3 | 45/45 |
| Vendor #4 | 90/90 |
| Work Order subresources #5 | 295/295 |
| Ownership #6 | 215/215 |
| Complete safe core | 919/919, 13 suites (870 + picker 49) |
| Authentication | 31/31 |
| Frontend compatibility/isolation | 16/16 |
| Application TypeScript, syntax, whitespace/security scope | PASS |
| npm ls --depth=0, all three packages | exit 0 |

Frontend retains 490 pre-existing/reused-environment extraneous entries; no
other npm ls problem or dependency/lockfile change. Tests used isolated,
fail-closed synthetic persistence with downloads disabled. Temporary dependency
links were removed. No real-data/deployed-runtime verification was performed.

Current Context/Open Threads now accurately record #3–#6/#13 closed, #16 verified
on its fix branch but unmerged/open, S3 deferred into P1 #14/#15, and #16 as the
final known P0 candidate from the post-#6 sweep. The broader P0 gate has not been
rerun or declared clear. #7 and CRM remain paused; #14/#15 remediation was not
started. Main and paused Interaction remain unchanged.

## Merged-main verification — September 21, 2026

Main fast-forwarded from `2f7bea84f2585eb6de14f3706c4b744b4719ab1b` to
`2bbe4ba5af5a38ed6f5b06ad7b5131126495df01`, with no implementation conflicts
or history rewriting. Fresh verification passed: original frozen S2 assertions
11/11 unchanged; permanent picker 49/49; Supplier 59, Facility 45, Vendor 90,
Work Order subresources 295, ownership 215; complete safe core 919/919;
authentication 31/31; frontend 16/16; application TypeScript, syntax, whitespace
and diff checks. Dependency inventory is unchanged (frontend retains 490
pre-existing extraneous entries). No manifest/lockfile or downstream changes.

Tests verify selected Facility authority, admin explicit selection, exclusion
of stale foreign assignments, no assignment-only read grant, exact four-field
projection and independent local/foreign attachment checks. Only isolated
synthetic persistence was used; no real-data or deployed-runtime verification.
#16 remains open until Interaction compatibility passes. The broader read-only
P0 gate remains pending; #14/#15 are P1 and #7/CRM remain paused.

## Interaction compatibility — September 21, 2026

Merged verified main `20f3d65ceea25f1fed8bcdb071be11ec4fc1af37` into paused
Interaction without history rewriting or production conflicts. Expected memory
document conflicts were resolved semantically, preserving Interaction history.
The combined app exposed a stale picker test-router interface; work stopped for
explicit approval. After approval, only `interactionJsonErrorHandler` was added
to each router mock in the permanent picker and frozen reproduction suites.
The frozen file matches evidence `ed51a0e` byte-for-byte after reversing that
one addition; assertions, fixtures, status codes and all 91 cases are unchanged.

Fresh results: complete combined core 973/973 = main 919 + Interaction 54
(or prior combined 924 + picker 49). Picker 49, Supplier 59, Facility 45, Vendor
90, subresources 295, ownership 215 and Interaction 54 all pass. Original S2
security 11/11 passes (80 historical observations excluded), authentication
31/31, frontend compatibility 16/16, application TypeScript, syntax, whitespace
and diff checks pass. All three dependency inventories exit zero; the root
Interaction environment reports no extraneous entries, whereas the earlier
main linked environment reported 490 frontend entries. No dependencies or
lockfiles were changed. No real-data or deployed-runtime verification occurred.

The merge containing this entry is the compatibility checkpoint. Interaction
remains paused and is not merged into main. #16 closure follows successful
publication; the read-only P0 gate follows closure.
