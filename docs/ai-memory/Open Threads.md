# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Current stabilization checkpoint — September 21, 2026

This checkpoint supersedes the earlier branch-specific handoffs. Gitea #3
(Facility isolation), #4 (Vendor authorization/lifecycle), #5 (Work Order
subresources), and #6 (Asset/Work Order ownership) are merged, verified and closed.
Main now includes Supplier fix `e95d22dcd2a67eeef436867170a46ccd882e6a2a`;
the resulting main documentation checkpoint is recorded by Git.
Interaction compatibility now passes core 924/924, authentication 31/31,
frontend compatibility 21/21 and application TypeScript. The merge containing
this handoff records the new paused Interaction checkpoint in Git.
Do not merge Interaction into main.

**#13 Supplier: main and Interaction compatibility verified; publication and
final issue closure follow this merge checkpoint.** Main fast-forwarded from
`c31f309f9747a5959f91e316c275e308d7b7bcc5` to Supplier fix
`e95d22dcd2a67eeef436867170a46ccd882e6a2a`. Evidence checkpoint: `c99c91f`.
The documentation-only commit containing this handoff follows the verified
code merge; Git records the resulting main hash. Interaction compatibility for
#13 passed fresh verification on September 21; see the Supplier journal.
See the [Supplier journal](<../engineering-journal/2026-09-16 - Supplier Authentication Reproduction.md>)
for accepted policy, immutable reproduction evidence and verification.
Supplier remains shared internal reference data: admin read/create, canonical
technician read only, all other roles denied. No Facility/tenant ownership or
new lifecycle endpoints. Creation excludes client metadata; reads explicitly
project approved fields. Permanent Supplier 59/59 and all six original security
assertions pass unchanged; safe core 870/870, Facility 45/45, Vendor 90/90,
subresources 295/295, ownership 215/215, authentication 31/31 and application
TypeScript passed fresh merged-main verification. All persistence verification is isolated and
synthetic; deployed behavior and real data remain unverified.

**P0 SECURITY/OWNERSHIP STABILIZATION GATE: BLOCKED.** The post-#6 read-only
review is already complete. After #13 passes Interaction compatibility and closes, the remaining
mounted candidates require separate reproduction:

- S2: shared-resource ordinary-update bypass of admin archival boundaries.
- S3: test-equipment picker Facility authorization bypass.

These remain candidates pending reproduction, not newly verified defects.
Rerun the P0 gate after remediation of its confirmed blockers. #7, P1 security
work, Interaction frontend, Opportunity and all new CRM development remain
paused. Do not begin S2/S3 in the Supplier publication task.
Vendor creation remains disabled; ownership normalization, audited Asset
transfer and deployed transaction capability remain deferred.
Ticket promotion requires transaction-capable MongoDB and returns 503 without
partial state on unsupported standalone topology; deployed capability remains
unverified. The Interaction backend is complete on its paused branch; its
frontend has not begun. Earlier #3–#6 investigation and verification remain in
the [Facility](<../engineering-journal/2026-09-15 - Facility Query Isolation Reproduction.md>),
[Vendor](<../engineering-journal/2026-09-15 - Vendor Authentication and Ownership Reproduction.md>),
[Work Order subresource](<../engineering-journal/2026-09-15 - Work Order Subresource Ownership Reproduction.md>)
and [ownership](<../engineering-journal/2026-09-15 - Asset Work Order Ownership Reproduction.md>) journals.

## Paused Interaction backend history

The Interaction backend base is `3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4`;
its preserved backend checkpoint is `ce535d39627f7a77f9e342fd9146e8ba361f5899`
and governance checkpoint `898d05e98afead5644ce3d78164df0f9948f0473`.
Gitea #2 remains its tracking issue and is not modified by Supplier stabilization.
The backend's accepted Facility/visibility/audit policy and 54-test behavior
remain authoritative. Interaction frontend and Opportunity remain paused.
Historical #3/#4/#5/#6 compatibility totals were 265/355/650/865 core cases;
these do not establish the pending #13 compatibility result. Earlier detailed
handoffs remain preserved in Git and the Interaction/Security journals.
The main-to-Interaction merge aligns three test-router mocks with existing
exports; no additional production behavior changes were introduced. The frozen
Supplier reproduction differs from c99c91f only by its Interaction error-handler
mock export; all assertions and fixtures remain byte-for-byte unchanged.
Compatibility passed: core 924/924 (870 main + 54 Interaction), original Supplier
security 6/6, authentication 31/31, frontend 21/21 and application TypeScript.
Both Interaction pushes and final #13 comment/closure follow this checkpoint;
the issue records their outcome. P0 remains blocked pending S2/S3 reproduction.

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
