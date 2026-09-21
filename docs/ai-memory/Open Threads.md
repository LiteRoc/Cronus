# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Current stabilization checkpoint — September 21, 2026

**P0 SECURITY/OWNERSHIP STABILIZATION GATE: PASS**

The P0 security/ownership stabilization phase is complete at this checkpoint.
A fresh read-only review of mounted application source at main
`20f3d65ceea25f1fed8bcdb071be11ec4fc1af37`, after #16 closure, found no new
credible mounted P0 candidate requiring reproduction. This is a focused source
review supported by isolated regression evidence, not deployed-runtime assurance.
The documentation-only commit containing this handoff records the stopping point.

Gitea #3, #4, #5, #6, #13 and #16 are verified closed. #16 fix
`2bbe4ba5af5a38ed6f5b06ad7b5131126495df01` entered main by fast-forward.
Merged-main verification passed: safe core 919/919, frozen S2 security 11/11,
picker 49/49, Supplier 59, Facility 45, Vendor 90, subresources 295, ownership
215, authentication 31/31, frontend 16/16 and application TypeScript.

Paused Interaction incorporated verified main at
`45f19da5bc5572b9b35c3290559b3a585058af0b`, pushed to both remotes. Combined
core passed 973/973 = main 919 + Interaction 54; original S2 security 11/11,
authentication 31/31, frontend 16/16 and TypeScript passed. Only the existing
interactionJsonErrorHandler export was added to each picker router mock;
all other evidence/assertion/fixture bytes remain unchanged. Interaction has
not entered main. Later documentation-only synchronization does not change
this verified implementation checkpoint.

#16 requires explicit authorized selected Facility for canonical admin and
technician, personally assigned same-Facility active/nondeleted test equipment,
and exactly _id, ctrlNumber, manufacturer, model. No global admin picker or
assignment-only cross-Facility grant exists. #5 attachment protection remains
independent. [Final #16 verification/closure](http://192.168.1.185:3000/LiteRoc/cronus/issues/16#issuecomment-103).

S3 reproduced no P0 operational removal effect. #14 Part/Manufacturer lifecycle
and #15 Template lifecycle remain OPEN P1, with accepted policies unimplemented.
Other deferred items: historical-reference isolation/ownership normalization,
JWT configuration/test-mode hardening, customer identity mismatch, historical
plaintext-password possibility, Part/Procedure/Task policy, role minimization,
safe-error/logging consistency and deployed transaction capability. These were
not promoted to P0 without new evidence and were not remediated.

**STOP.** #7 (WorkOrder cost snapshots across every mutation path) is the next
original business-correctness stabilization issue, recommended for a separately
authorized investigation only. It has not started. #14/#15 remediation,
Interaction frontend, Opportunity and other CRM work have not started; CRM
remains paused pending human direction. No real databases, deployed services,
Docker, scheduled jobs or dependencies were changed.

See [the final read-only gate record](<../engineering-journal/2026-09-21 - Final P0 Security Ownership Gate.md>)
and [the #16 journal](<../engineering-journal/2026-09-21 - Test Equipment Picker Facility Authorization Reproduction.md>).

## Paused Interaction backend history

The following records earlier compatibility checkpoints. Current issue closure
and gate disposition are authoritative in the stopping-point section above.

The Interaction backend base is `3ba37f21d520cfe64d3d9bf5eb950a0e6f7a44d4`;
its preserved backend checkpoint is `ce535d39627f7a77f9e342fd9146e8ba361f5899`
and governance checkpoint `898d05e98afead5644ce3d78164df0f9948f0473`.
Gitea #2 remains its tracking issue and is not modified by Supplier stabilization.
The backend's accepted Facility/visibility/audit policy and 54-test behavior
remain authoritative. Interaction frontend and Opportunity remain paused.
Historical #3/#4/#5/#6 compatibility totals were 265/355/650/865 core cases;
these are historical baselines, not the pending #16 compatibility result. Earlier detailed
handoffs remain preserved in Git and the Interaction/Security journals.
The main-to-Interaction merge aligns three test-router mocks with existing
exports; no additional production behavior changes were introduced. The frozen
Supplier reproduction differs from c99c91f only by its Interaction error-handler
mock export; all assertions and fixtures remain byte-for-byte unchanged.
Compatibility passed: core 924/924 (870 main + 54 Interaction), original Supplier
security 6/6, authentication 31/31, frontend 21/21 and application TypeScript.
The prior #13 compatibility checkpoint was pushed and #13 is closed. The current
main-to-Interaction #16 merge passed fresh compatibility: combined core 973/973
(919 main + 54 Interaction), original S2 security 11/11 unchanged, picker 49/49,
authentication 31/31, frontend 16/16 and application TypeScript. Only the existing
interactionJsonErrorHandler export was added to the two picker router mocks;
all assertion and fixture bytes are unchanged. Publication and #16 closure
follow this checkpoint; the broader P0 review has not yet been rerun.
S3 is deferred as P1 #14/#15; the broader P0 review awaits #16 closure.

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
