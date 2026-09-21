# Open Threads

This file records verified defects and clearly unresolved engineering work. Runtime-test failures are evidence for exercised behavior; static or compatibility findings remain labeled as unresolved until verified.

## Current stabilization checkpoint — September 21, 2026

This checkpoint supersedes earlier branch-specific handoffs. Main fast-forwarded
from `2f7bea84f2585eb6de14f3706c4b744b4719ab1b` to verified #16 fix
`2bbe4ba5af5a38ed6f5b06ad7b5131126495df01`; this documentation commit follows. Gitea #3 (Facility isolation), #4
(Vendor authorization/lifecycle), #5 (Work Order subresources), #6 (Asset/Work
Order ownership) and #13 (Supplier authorization) are verified and closed.
Paused Interaction remains `e242b2044cca33a09359bc37cf2bdb1a0c7641a6`;
its Supplier compatibility passed core 924/924, authentication 31/31,
frontend 21/21 and application TypeScript. Do not merge Interaction into main.

**#16 is merged and verified on main.** The merge was a clean fast-forward,
without rewriting history. Evidence remains `ed51a0e1eab67ef00fc7501b4f7557c22c84b0aa`.
[Gitea #16](http://192.168.1.185:3000/LiteRoc/cronus/issues/16) remains open pending
Interaction compatibility. Interaction must remain paused and must not enter main.

S2 (#16), the test-equipment picker, was the final known P0 candidate from the
post-#6 sweep and reproduced material foreign-Facility disclosure. Its fix
requires canonical admin/technician, explicit authorized selected Facility for
both roles, personally assigned same-Facility active/non-deleted equipment and
a qualifying Template. There is no global admin picker or assignment read grant.
The response is exactly _id, ctrlNumber, manufacturer, model; all active consumers
need only these fields. Frontend explicit headers and Facility-keyed caching
isolate switches and stale success/failure responses. #5 attachment authorization
remains independently enforced. No ownership or lifecycle schema was redesigned.

Fresh merged-main verification: original S2 security 11/11 unchanged; permanent
picker 49/49; complete safe core 919/919 (main 870 + picker 49); Supplier 59,
Facility 45, Vendor 90, subresources 295, ownership 215; authentication 31/31;
frontend 16/16; application TypeScript. The frozen 91-case reproduction remains
historical evidence (before: 80 passing, 11 failures); the permanent suite governs
ongoing regression. See the [#16 journal](<../engineering-journal/2026-09-21 - Test Equipment Picker Facility Authorization Reproduction.md>).

**P0 GATE: NOT CLEARED; broader review has not been rerun.** #7 remains paused,
as do Interaction frontend, Opportunity and all new CRM development. Next is the authorized Interaction compatibility checkpoint, followed only on
success by #16 closure and the read-only P0 gate review. No other remediation
is authorized in this sequence.

S3 shared-resource archival reproduced no P0 operational removal effect and was
reclassified into open P1 backlog issues
[#14 Part/Manufacturer](http://192.168.1.185:3000/LiteRoc/cronus/issues/14) and
[#15 Template](http://192.168.1.185:3000/LiteRoc/cronus/issues/15).
Its evidence/policy is preserved at `84d58ee4927ff4a23dbfd6c5add1b43ef404f49f`
on fix/shared-resource-archive-auth (tracking tip 6dc5322). S3 no longer blocks
P0; its accepted shared-reference archive/restore/UDI policies remain unimplemented
and remediation deferred until P0 clears. Current naming is S2 picker, S3 shared
lifecycle; older sweep notes used reversed numbering.

All persistence verification used isolated synthetic databases. Real data and
deployed behavior remain unverified. Vendor creation, ownership normalization,
audited Asset transfer and deployed transaction capability remain deferred.
Ticket promotion needs transaction-capable MongoDB and fails safely with 503 on
unsupported standalone topology. No real data or runtime infrastructure changed.

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
