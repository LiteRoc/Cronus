# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Current stabilization checkpoint — September 21, 2026

This checkpoint supersedes earlier branch-specific handoffs. Main remains
`2f7bea84f2585eb6de14f3706c4b744b4719ab1b`. Gitea #3 (Facility isolation), #4
(Vendor authorization/lifecycle), #5 (Work Order subresources), #6 (Asset/Work
Order ownership) and #13 (Supplier authorization) are verified and closed.
Supplier fix e95d22d is on main. Paused Interaction is
`e242b2044cca33a09359bc37cf2bdb1a0c7641a6`, published to Gitea and GitHub;
compatibility passed core 924/924 (main 870 + Interaction 54), original Supplier
security 6/6, authentication 31/31, frontend 21/21 and application TypeScript.
Do not merge Interaction into main. Its frontend remains unstarted.

**P0 SECURITY/OWNERSHIP STABILIZATION GATE: NOT CLEARED.**
The post-#6 sweep is complete. **S3 has been reproduced and no P0 operational
archive/removal effect was found. S3 no longer blocks the P0 gate.** Its confirmed
security/lifecycle integrity defects are deferred into two open P1 issues:

- [#14 — Protect Part and Manufacturer lifecycle fields](http://192.168.1.185:3000/LiteRoc/cronus/issues/14).
- [#15 — Enforce Template lifecycle authorization](http://192.168.1.185:3000/LiteRoc/cronus/issues/15).

Evidence/policy commit: `84d58ee4927ff4a23dbfd6c5add1b43ef404f49f` on
`fix/shared-resource-archive-auth`, published to both remotes. Reproduction is
237 cases: 228 passing controls/observations and nine intentional security
failures. Baselines passed unchanged: Supplier 59, Facility 45, Vendor 90,
subresources 295, ownership 215, full safe core 870 and authentication 31.
See the [S3 journal](<../engineering-journal/2026-09-21 - Shared Resource Archive Authorization Reproduction.md>)
for immutable reproduction-time observations and the dated accepted policy.
The publication/tracking documentation commit follows that evidence commit.

**Exact next task: reproduce S2 — test-equipment picker Facility authorization —
in an isolated synthetic investigation from current main, preserving paused
Interaction.** S2 is the final known P0 candidate from the post-#6 sweep, not a
newly confirmed defect. It was not started in the S3 preservation task.
Rerun the P0 gate after S2 reproduction and resolution of any confirmed P0
blocker. #7 remains paused until S2 is reproduced and the P0 gate is rerun.
S3/P1 remediation remains deferred until P0 clears. Interaction frontend,
Opportunity and other new CRM development remain paused.

Current naming follows the user's assignments: S3 is shared-resource lifecycle;
S2 is the equipment picker. Earlier sweep notes used the reverse numbering.

Accepted future policy keeps all three resources shared reference/catalog data
without Facility ownership. Archive is admin-controlled, excludes active
lists/pickers and new references, and preserves historical references. There is
no restore workflow in this slice. Ordinary business updates must protect
server lifecycle/audit state and reject operators/pipelines. Legitimate business
status editing remains distinct from archive. Template archive audit must be
explicit; matching archived Templates must fail safely/conflict in DI/UDI flows
rather than being reused or silently reactivated. **This policy is accepted but
not implemented.** Complete requirements are in #14/#15 and the dated journal.

All persistence verification was isolated and synthetic; deployed behavior and
real data remain unverified. Vendor creation stays disabled; ownership
normalization, audited Asset transfer and deployed transaction capability remain
deferred. Ticket promotion requires transaction-capable MongoDB and returns 503
without partial state on unsupported standalone topology.

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

The Phase 1 architecture and policies are accepted. The Contact and Facility-scoped FollowUp vertical slices are complete and verified. The items below remain genuinely deferred or unresolved; they do not reopen accepted policies or implemented invariants.

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
- Interactions retain creator/updater and timestamps, but a formal retention policy and retention workflow are deferred.
- Automatic Opportunity-to-Contract draft handoff is deferred. A manually created Contract may later be linked without rewriting Opportunity history.

### Deferred signals

- Percentile/high-service-cost and trend signals are deferred until production history supports meaningful thresholds.
- Facility-wide uncovered-equipment, rising-cost, repeated-failure, and aging-concentration signals require efficient queries and accepted business definitions before implementation.

### Deferred frontend maintenance

- The existing TypeScript `ignoreDeprecations: "6.0"` setting is incompatible with the installed TypeScript 5.6 compiler; Contact verification used the established command-line compatibility override. Do not mix that configuration repair into CRM feature work.
- The existing ESLint configuration uses invalid `"ignore"` rule severity values and prevents the established lint command from starting. Repair remains separate maintenance.
- The existing Vite large-bundle warning and Node engine warning remain deferred environment/build work.

See the [CRM architecture assessment journal](<../engineering-journal/2026-08-24 - CRM Strategic Account Architecture Assessment.md>) for assessment evidence and the [CRM Phase 1 policy decisions](<../engineering-journal/2026-08-25 - CRM Policy Decisions for Review.md>) for the accepted authoritative policy.
