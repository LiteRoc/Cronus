# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Completed code remediation — Gitea #3 merged into main

Authoritative main `4771555ed50044bedaa464127a2fe68e6f32c769` includes
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
Gitea #3 is closed. Current main `a7ad89724722b999bb0b201ae894142eae82c8ea` also includes the verified #4 remediation.

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

Latest #4 compatibility verification (2026-09-15): main
`a7ad89724722b999bb0b201ae894142eae82c8ea` is incorporated without history
rewriting. Interaction 54/54, Vendor 90/90, Facility 45/45 and complete safe core
355/355 (166 shared + 54 Interaction + 45 Facility + 90 Vendor) passed;
authentication 31/31, historical Vendor references 6/6 and analytics 3/3 passed.
Restricted Interaction visibility, Contact validation, and #3/#4 protections
remain intact. Syntax, dependency and whitespace checks passed. #3 and #4 code
remediation is resolved on main; Gitea records the final #4 closure separately.
Vendor creation remains disabled, tenantId normalization deferred, features paused,
and #5 not started. No real-data or deployed-runtime verification occurred.

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
  on main. The Interaction compatibility gate has passed; final closure is recorded in Gitea. Evidence checkpoint: `59b4056c358d0bb2d42e6238bf50ba1a74be7749`.
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
- Gitea #5 has not started. New features remain paused. Do not revive unmounted
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
