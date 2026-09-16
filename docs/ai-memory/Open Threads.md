# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Completed code remediation — Gitea #3 merged into main

The #3 main checkpoint `4771555ed50044bedaa464127a2fe68e6f32c769` includes
fix `c89f22193e9eb3ca810af7087bb6392c15897ccc`. Four defects reproduced
against `3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4` are resolved:

- P0 Asset search: list/count/page queries preserve Facility visibility.
- P0 Work Order search: ordinary and analytics queries preserve Facility visibility.
- P1 Template lifecycle: authorized selected Facility controls summaries and tenant benchmarks.
- P1 Asset duplicate warnings: inaccessible foreign identifiers are not disclosed.

All 29 original reproduction cases pass unchanged, including the 11 controls
and 18 formerly failing security assertions. Merged-main verification passed
45/45 permanent Facility cases, 211/211 core tests, and 31/31 authentication
tests. Intended admin/global behavior remains preserved. These are isolated
synthetic results, not production exploitation or deployed verification.
See the [September 15 report](<../engineering-journal/2026-09-15 - Facility Query Isolation Reproduction.md>).
Gitea #3 is closed. Main `c31f309` includes verified #3/#4/#5/#6 remediation; #6 compatibility passed and Gitea records final closure after publication.

Stabilization remains the priority. Other September findings remain
hypotheses/unresolved according to their recorded status. Gitea #2 tracks
the implemented, reviewed, committed and pushed Interaction backend.
Its frontend has not begun; Interaction frontend and Opportunity remain
paused. Do not merge Interaction into main. Accepted Interaction architecture,
verification history, and deferred revision history/retention remain intact.

Earlier #3 compatibility verification (2026-09-15, before Vendor remediation):
Interaction 54/54, permanent Facility 45/45, combined safe core-service
265/265 (166 shared + 54 Interaction + 45 Facility), and authentication
31/31 passed. Restricted visibility, Contact validation, and all Facility
regressions remain intact in isolated tests. Syntax, dependency consistency,
whitespace, and focused visibility/scope checks passed. No real-data or
deployed-runtime verification was performed. Interaction remains paused.

Earlier #4 compatibility verification (2026-09-15): main
`a7ad89724722b999bb0b201ae894142eae82c8ea` is incorporated without history
rewriting. Interaction 54/54, Vendor 90/90, Facility 45/45 and complete safe core
355/355 (166 shared + 54 Interaction + 45 Facility + 90 Vendor) passed;
authentication 31/31, historical Vendor references 6/6 and analytics 3/3 passed.
Restricted Interaction visibility, Contact validation, and #3/#4 protections
remain intact. Syntax, dependency and whitespace checks passed. #3 and #4 code
remediation is resolved on main; Gitea records the final #4 closure separately.
Vendor creation remains disabled, tenantId normalization deferred, features paused,
at that checkpoint. No real-data or deployed-runtime verification occurred.

## Gitea #5 — resolved and merged

- Main includes verified fix `30e521113749b01987ffbbb10381ed80cf736d0f` via
  fast-forward. #5 is resolved on main. Evidence checkpoint:
  `72837f3c77f39fdba96055b03e8be8c93faa8165`.
- Parent Work Order Facility scope, equipment role/reference checks, narrow
  responses, protected ordinary PUT and safe Procedure/result errors are fixed on
  merged main. Tests: original security 20/20 unchanged; permanent #5 295/295;
  core 596/596; Facility 45/45; Vendor 90/90; auth 31/31; frontend equipment 5/5.
- Frozen pre-policy expectations remain historical, not the normal green suite.
- Part/Procedure/Task ownership remains deliberately unchanged. #7 cost correctness,
  #9 procedure units and unmounted labor/travel PATCH helpers remain deferred.
- #7 has not started. New feature development, Interaction frontend and Opportunity
  remain paused. Do not merge Interaction into main.
- See the [#5 journal](<../engineering-journal/2026-09-15 - Work Order Subresource Ownership Reproduction.md>).

Earlier #5 compatibility verification (2026-09-15): main `1122219e401d272377bdb93daf98bb8fb5ec8554`
is incorporated without rewriting Interaction history. Interaction 54/54,
Work Order security 295/295, Vendor 90/90, Facility 45/45 and complete safe core
650/650 (166 shared + 54 Interaction + 45 Facility + 90 Vendor + 295 Work Order)
passed. Authentication 31/31 and frontend equipment compatibility 5/5 passed;
syntax, dependency and whitespace checks passed. Restricted Interaction visibility,
Contact validation and #3/#4/#5 protections coexist. #7 costs and #9 units remain
unchanged. No real-data/deployed-runtime verification occurred. At that historical checkpoint #6 had not started;
Interaction frontend and Opportunity remain paused. Gitea records final #5 closure.

## Gitea #6 — merged-main and Interaction compatibility verification passed

Main `c31f309f9747a5959f91e316c275e308d7b7bcc5` includes verified #3/#4/#5/#6
remediation and is published to Gitea/GitHub. Its merged-main checks passed:
core **811/811**, authentication **31/31**, frontend ownership/equipment **21/21**
and actual application TypeScript. The intentional handoff is preserved in
`8acb950`; remediation remains `d650873`.

The merge into paused Interaction passed its complete compatibility gate after
one approved test-only correction: the #6 application-registration router mock
now provides the existing `interactionJsonErrorHandler` export. Production
Interaction code and its tests are unchanged. The affected test passes **1/1**;
Interaction **54/54**; #6 **215/215**; #5 **295/295**; #4 **90/90**; #3 **45/45**;
complete safe core **865/865** = 811 main + 54 Interaction. Authentication **31/31**,
frontend **21/21**, application TypeScript, syntax, npm ls for all three packages,
whitespace, conflict-marker and focused security/scope checks passed.

The earlier 864/865 failure was a stale test double, now resolved. This checkpoint
completes code compatibility; Git refs and Gitea record the subsequent pushes,
final verification comment and #6 closure. Close #6 only after both remote
Interaction refs match this verified merge. Do not merge Interaction into main.

All database verification used isolated synthetic persistence with downloads
disabled. Ticket promotion still requires transaction-capable MongoDB and fails
with 503 without partial state on unsupported standalone topology. No real-data
or deployed-runtime verification occurred. Vendor creation stays disabled;
normalization and audited Asset transfer remain deferred. P0 review and #7
were not started in this task. Interaction frontend and Opportunity remain paused.

Frozen evidence remains historical; all retained security-labelled exceptions
are classified in the [#6 journal](<../engineering-journal/2026-09-15 - Asset Work Order Ownership Reproduction.md>).
The P0 review and #7 remain separate subsequent tasks.

## Completed baseline: core-service authentication hardening

Core-service authentication hardening is complete. The authentication baseline improved from 22/31 passing tests before remediation to 31/31 afterward.

- Missing roles no longer default to administrator; issuer and audience are enforced.
- Route declarations using legacy `tech` are canonicalized to `technician`, while tokens claiming `tech` are rejected.
- Sensitive authentication/user/password-hash logging was removed, and `/auth/profile` uses the canonical hardened middleware.
- Existing tokens lacking valid issuer/audience claims or claiming `tech` may require reauthentication.
- Verification also passed the full contract-service suite (7/7 suites, 100/100 tests), the core-service suite (1/1 suite, 3/3 tests), syntax checks, and `git diff --check` under system Node 18 using isolated MongoMemoryServer databases. No real database was modified.

## Contract and data compatibility

### Wayne Healthcare financial discrepancy

- `WHC-CAM-2024-001` has candidate baseline `$94,881.90`, ledger result `$383,524.75`, and stored `totalValue` `$383,524.74`.
- No authoritative repository source explains the penny difference.
- Do not repair until external commercial evidence resolves it; do not guess or round it away.

### Historical `linkedWorkOrders`

- `WorkOrder.contractId` is authoritative for active behavior.
- `Contract.linkedWorkOrders` remains because local read-only inspection found 36 references on one historical Contract.
- Removing it requires an explicit compatibility and migration decision.

### Multi-replica lifecycle execution

- Contract lifecycle operations are idempotent and same-process overlap is prevented.
- `noOverlap` is not a distributed lock; multiple replicas could race. Current Compose does not declare replicas.
- Do not add distributed infrastructure without explicit deployment evidence and authorization.

### Unmounted Customer/Vendor modules

- Contract-service Customer/Vendor implementations remain unmounted.
- Core-service appears to own active Vendor/Customer behavior, but external compatibility and historical ownership are not sufficiently proven for deletion.

## Other unresolved security/data risks

### Existing legacy `tech` records

Whether operational data contains legacy `tech` user records, and which callers depend on that value, remains unknown. Any assessment or normalization requires explicit database authorization.

### Possible existing plaintext-password records

The historical registration path could store plaintext passwords. Model middleware protects ordinary future `save` operations, but existing data was not inspected or migrated.

### `customerId` registration and tenant behavior

Registration requires `customerId` for customers, while static inspection previously found no corresponding current `User` schema/token field. Persistence and tenant behavior require a separate tenant-sensitive investigation.

### Password writes bypassing Mongoose save middleware

The hashing invariant applies to ordinary `save`; update, bulk, import, or direct-collection paths may bypass it and require deliberate review.

## Environment and dependency maintenance

- Authentication verification ran under system Node 18; test tooling recommends Node `>=20.19`, and previous Cronus verification succeeded under Node 22. Runtime standardization remains future environment maintenance.
- Dependency vulnerability remediation remains deferred. Do not run `npm audit fix` automatically.
- Node runtime and dependency-directory ownership cleanup remain environment maintenance, separate from product/security commits.

## CRM / Strategic Account Management deferred work

The Phase 1 architecture and policies are accepted. Contact and Facility-scoped FollowUp are complete and verified. The Facility-scoped Interaction backend, the third CRM vertical slice, is complete and verified; its frontend remains outstanding. The items below remain genuinely deferred or unresolved; they do not reopen accepted policies or implemented invariants.

### Gitea #4 — code resolved on main; Vendor normalization deferred

- Remediation `942233fa1974ee8ca5e090b625583f064e507a0f` is merged and verified
  on main. Gitea #4 is closed after the Interaction compatibility gate. Evidence checkpoint: `59b4056c358d0bb2d42e6238bf50ba1a74be7749`.
- Vendor is shared reference data, not Facility-owned CRM. Admin read/update/archive,
  technician restricted read, all other roles denied; no anonymous access. Creation
  is disabled pending ownership normalization. Notes/preferredVendor are admin-only.
- tenantId is retained unchanged, excluded from responses and client updates, and
  not used for authorization. Its long-term Organization/ownership semantics remain
  unresolved; no migration, reinterpretation or backfill occurred.
- Soft archive replaces API hard delete. Archived records leave normal reads/lists;
  ID/name-only history preserves references. Legacy missing-tenant records can be
  read/archived, but ordinary invalid updates return conflict without silent repair.
- Before: 60 observations/controls passed, ten security assertions failed. After:
  all ten security assertions pass unchanged; 56 frozen historical expectations
  fail because the accepted policy removed those behaviors. The 90-case permanent
  Vendor suite is the ongoing regression authority. Full core 301/301 and relevant
  auth/history/analytics/frontend checks passed; no real-data/runtime verification.
- See the [Vendor journal](<../engineering-journal/2026-09-15 - Vendor Authentication and Ownership Reproduction.md>).
- New features remain paused. Do not revive unmounted
  Vendor modules or introduce implicit CRM Vendor dependencies.

### Deferred authorization and Organization capabilities

- Phase 1 uses canonical `admin`, `technician`, `customer`, and `viewer` roles. A granular CRM capability/role system is deferred until actual usage requires it.
- Organization-wide views may aggregate only already-authorized Facilities. Separate Organization-wide authorization grants are deferred.

### Deferred CRM workflows

- Contact duplicate detection produces warnings only. An audited Contact merge workflow is deferred.
- Interactions retain creator/updater and timestamps and remain editable in Phase 1. Formal revision history, retention policy, and retention workflow are deferred.
- Opportunity linkage is deferred until the Opportunity vertical slice establishes its strict Facility-scoped validation boundary.
- Contract linkage is deferred until an authenticated, strict Facility-scoped cross-service validation boundary is accepted.
- Automatic Opportunity-to-Contract draft handoff is deferred. A manually created Contract may later be linked without rewriting Opportunity history.

### Deferred signals

- Percentile/high-service-cost and trend signals are deferred until production history supports meaningful thresholds.
- Facility-wide uncovered-equipment, rising-cost, repeated-failure, and aging-concentration signals require efficient queries and accepted business definitions before implementation.

### Deferred frontend maintenance

- The existing TypeScript `ignoreDeprecations: "6.0"` setting is incompatible with the installed TypeScript 5.6 compiler; Contact verification used the established command-line compatibility override. Do not mix that configuration repair into CRM feature work.
- The existing ESLint configuration uses invalid `"ignore"` rule severity values and prevents the established lint command from starting. Repair remains separate maintenance.
- The existing Vite large-bundle warning and Node engine warning remain deferred environment/build work.
- Core-service backend tests continue to use experimental Jest VM-module/specifier-resolution flags; this warning remains deferred environment work.

See the [CRM architecture assessment journal](<../engineering-journal/2026-08-24 - CRM Strategic Account Architecture Assessment.md>) for assessment evidence and the [CRM Phase 1 policy decisions](<../engineering-journal/2026-08-25 - CRM Policy Decisions for Review.md>) for the accepted authoritative policy.
